import type {PaperBibliography, PaperRecord} from "./paper-types";

const controls = /\p{Cc}/u;

export function normalizeDoi(value: unknown): string {
  if (typeof value !== "string") return "";
  const doi = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  return doi.length <= 300 && /^10\.\d{4,9}\/[^\s<>"{}]+$/i.test(doi) && !controls.test(doi) ? doi.toLowerCase() : "";
}

function boundedText(value: unknown, limit: number): string | undefined {
  return typeof value === "string" && value.length <= limit && !controls.test(value) ? value.trim() : undefined;
}

function strings(value: unknown, count: number, length: number): string[] | undefined {
  if (!Array.isArray(value) || value.length > count) return undefined;
  const result: string[] = [];
  for (const item of value) {
    const text = boundedText(item, length);
    if (text === undefined || !text) return undefined;
    if (!result.includes(text)) result.push(text);
  }
  return result;
}

export function normalizeBibliography(value: unknown): PaperBibliography | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const authors = strings(record.authors, 100, 200);
  const tags = strings(record.tags, 30, 60);
  const venue = boundedText(record.venue, 500);
  const rawDoi = boundedText(record.doi, 300);
  const rawUrl = boundedText(record.url, 2048);
  const year = record.year;
  if (!authors || !tags || venue === undefined || rawDoi === undefined || rawUrl === undefined
    || !(year === null || typeof year === "number" && Number.isInteger(year) && year >= 1000 && year <= 2100)
    || !(record.source === "manual" || record.source === "Crossref") || typeof record.confirmed !== "boolean") return undefined;
  const doi = normalizeDoi(rawDoi);
  if (rawDoi && !doi) return undefined;
  let url = "";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) return undefined;
      url = parsed.href;
      if (url.length > 2048) return undefined;
    } catch {return undefined;}
  }
  return {authors, year: year as number | null, venue, doi, url, tags, source: record.source, confirmed: record.confirmed};
}

function line(value: string) {return value.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();}
function bibText(value: string) {
  const escapes: Record<string, string> = {"\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "%": "\\%", "$": "\\$", "#": "\\#", "&": "\\&", "_": "\\_", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}"};
  return line(value).replace(/[\\{}%$#&_^~]/g, character => escapes[character]);
}

export function citationText(paper: PaperRecord, format: "bib" | "ris"): string {
  const metadata = normalizeBibliography(paper.bibliography);
  if (!metadata?.confirmed) throw new Error("请先核对并确认书目信息，再导出引用。");
  const title = line(paper.title);
  if (!title) throw new Error("请先补充论文标题，再导出引用。");
  if (format === "ris") {
    return ["TY  - GEN", `TI  - ${title}`, ...metadata.authors.map(author => `AU  - ${line(author)}`),
      ...(metadata.year === null ? [] : [`PY  - ${metadata.year}`]), ...(metadata.venue ? [`T2  - ${line(metadata.venue)}`] : []),
      ...(metadata.doi ? [`DO  - ${metadata.doi}`] : []), ...(metadata.url ? [`UR  - ${line(metadata.url)}`] : []),
      ...metadata.tags.map(tag => `KW  - ${line(tag)}`), "ER  -", ""].join("\r\n");
  }
  if (format !== "bib") throw new Error("不支持的引用格式。");
  const key = `acaora_${paper.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "paper"}`;
  const fields = [["title", title], ...(metadata.authors.length ? [["author", metadata.authors.join(" and ")]] : []),
    ...(metadata.year === null ? [] : [["year", String(metadata.year)]]), ...(metadata.venue ? [["howpublished", metadata.venue]] : []),
    ...(metadata.doi ? [["doi", metadata.doi]] : []), ...(metadata.url ? [["url", metadata.url]] : []),
    ...(metadata.tags.length ? [["keywords", metadata.tags.join(", ")]] : [])];
  return `@misc{${key},\n${fields.map(([name, value]) => `  ${name} = {${bibText(value)}}`).join(",\n")}\n}\n`;
}
