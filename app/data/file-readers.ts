import type { DataSet } from "../stats";
import { parseCsv } from "../stats";

export const acceptedDataFormats = [
  ".csv", ".tsv", ".txt",
  ".xlsx", ".xls", ".xlsm", ".ods",
  ".dta", ".sav", ".por", ".sas7bdat", ".xpt",
  ".rds", ".rda", ".rdata",
].join(",");

const excelExtensions = new Set(["xlsx", "xls", "xlsm", "ods"]);
const statExtensions = new Set(["dta", "sav", "por", "sas7bdat", "xpt"]);
const rExtensions = new Set(["rds", "rda", "rdata"]);

function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function matrixToDataSet(matrix: unknown[][], name: string): DataSet {
  const normalized = matrix
    .map((row) => row.map(stringifyCell))
    .filter((row) => row.some((cell) => cell.trim() !== ""));
  if (normalized.length < 2) throw new Error("文件中没有可分析的表格数据。");

  const width = Math.max(...normalized.map((row) => row.length));
  const rawHeaders = Array.from({ length: width }, (_, index) => normalized[0][index]?.trim() || `变量${index + 1}`);
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((header) => {
    const count = seen.get(header) ?? 0;
    seen.set(header, count + 1);
    return count ? `${header}_${count + 1}` : header;
  });
  const rows = normalized.slice(1).map((row) => headers.map((_, index) => row[index] ?? ""));
  return { name, headers, rows };
}

async function readExcel(file: File): Promise<DataSet> {
  const XLSX = await import("@e965/xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => {
    const range = workbook.Sheets[name]?.["!ref"];
    return Boolean(range);
  });
  if (!sheetName) throw new Error("工作簿中没有可读取的工作表。");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
  });
  return matrixToDataSet(matrix, `${file.name} · ${sheetName}`);
}

async function readStatFile(file: File): Promise<DataSet> {
  const { detectFormat, readData } = await import("@irbisadm/statfmt");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectFormat(bytes);
  const extension = extensionOf(file.name);
  const format = detected ?? (extension === "xpt" ? "xport" : extension);
  if (!["dta", "sav", "por", "sas7bdat", "xport"].includes(format)) {
    throw new Error("无法识别该统计软件文件，请确认文件没有损坏。");
  }
  const result = readData(format as "dta" | "sav" | "por" | "sas7bdat" | "xport", bytes);
  return {
    name: file.name,
    headers: result.variables.map((variable, index) => variable.name || variable.label || `变量${index + 1}`),
    rows: result.rows.map((row) => result.variables.map((variable) => stringifyCell(row[variable.index]))),
  };
}

let webRReady: Promise<import("webr").WebR> | null = null;

async function getWebR() {
  if (!webRReady) {
    webRReady = import("webr").then(async ({ WebR }) => {
      const webR = new WebR({ interactive: false });
      await webR.init();
      return webR;
    });
  }
  return webRReady;
}

async function readRFile(file: File): Promise<DataSet> {
  const webR = await getWebR();
  const extension = extensionOf(file.name);
  const inputPath = `/tmp/acaora-input.${extension}`;
  const outputPath = "/tmp/acaora-output.csv";
  await webR.FS.writeFile(inputPath, new Uint8Array(await file.arrayBuffer()));

  const loadObject = extension === "rds"
    ? `acaora_data <- readRDS("${inputPath}")`
    : `acaora_env <- new.env(); acaora_names <- load("${inputPath}", envir = acaora_env); acaora_candidates <- acaora_names[vapply(acaora_names, function(nm) is.data.frame(acaora_env[[nm]]) || is.matrix(acaora_env[[nm]]), logical(1))]; if (!length(acaora_candidates)) stop("未找到 data.frame 或 matrix"); acaora_data <- acaora_env[[acaora_candidates[[1]]]]`;

  try {
    await webR.evalRVoid(`
      ${loadObject}
      if (is.matrix(acaora_data)) acaora_data <- as.data.frame(acaora_data)
      if (!is.data.frame(acaora_data)) stop("R 文件中的对象不是二维数据框")
      write.csv(acaora_data, "${outputPath}", row.names = FALSE, na = "")
    `);
    const csv = new TextDecoder().decode(await webR.FS.readFile(outputPath));
    return parseCsv(csv.replace(/^\uFEFF/, ""), file.name);
  } catch (error) {
    throw new Error(error instanceof Error ? `R 文件读取失败：${error.message}` : "R 文件读取失败。");
  } finally {
    await Promise.allSettled([webR.FS.unlink(inputPath), webR.FS.unlink(outputPath)]);
  }
}

export async function readDataFile(file: File): Promise<DataSet> {
  const extension = extensionOf(file.name);
  if (extension === "csv") return parseCsv((await file.text()).replace(/^\uFEFF/, ""), file.name);
  if (extension === "tsv" || extension === "txt") {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const XLSX = await import("@e965/xlsx");
    const workbook = XLSX.read(text, { type: "string" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return matrixToDataSet(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" }), file.name);
  }
  if (excelExtensions.has(extension)) return readExcel(file);
  if (statExtensions.has(extension)) return readStatFile(file);
  if (rExtensions.has(extension)) return readRFile(file);
  throw new Error("暂不支持这个文件格式。请选择 CSV、Excel、Stata、SPSS、SAS 或 R 数据文件。");
}

export function formatLabel(fileName: string) {
  const extension = extensionOf(fileName);
  if (excelExtensions.has(extension)) return "EXCEL";
  if (extension === "dta") return "STATA";
  if (["sav", "por"].includes(extension)) return "SPSS";
  if (["sas7bdat", "xpt"].includes(extension)) return "SAS";
  if (rExtensions.has(extension)) return "R DATA";
  return extension.toUpperCase() || "DATA";
}
