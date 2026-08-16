export type DataSet = {
  name: string;
  headers: string[];
  rows: string[][];
};

export type NumericSummary = {
  name: string;
  n: number;
  missing: number;
  mean: number;
  sd: number;
  min: number;
  median: number;
  max: number;
};

export const sampleData: DataSet = {
  name: "student_sleep.csv",
  headers: ["编号", "性别", "年龄", "睡眠时长", "手机使用", "统计学成绩", "压力评分"],
  rows: [
    ["S01", "女", "21", "7.2", "3.1", "86", "5"],
    ["S02", "男", "20", "6.4", "4.6", "78", "7"],
    ["S03", "女", "22", "8.1", "2.5", "91", "3"],
    ["S04", "男", "21", "5.9", "5.2", "72", "8"],
    ["S05", "女", "20", "7.6", "2.9", "89", "4"],
    ["S06", "男", "22", "6.8", "4.1", "81", "6"],
    ["S07", "女", "21", "7.9", "2.2", "93", "3"],
    ["S08", "男", "20", "6.1", "5.0", "75", "8"],
    ["S09", "女", "22", "7.4", "3.3", "88", "5"],
    ["S10", "男", "21", "6.6", "4.4", "80", "7"],
    ["S11", "女", "20", "8.3", "2.1", "95", "2"],
    ["S12", "男", "22", "5.7", "5.7", "69", "9"],
    ["S13", "女", "21", "7.0", "3.7", "84", "6"],
    ["S14", "男", "20", "6.3", "4.8", "77", "7"],
    ["S15", "女", "22", "7.8", "2.6", "90", "4"],
    ["S16", "男", "21", "6.9", "3.9", "82", "6"],
    ["S17", "女", "20", "8.0", "2.4", "92", "3"],
    ["S18", "男", "22", "6.0", "5.3", "73", "8"],
    ["S19", "女", "21", "7.3", "3.0", "87", "5"],
    ["S20", "男", "20", "6.5", "4.5", "79", "7"],
    ["S21", "女", "22", "7.7", "2.8", "90", "4"],
    ["S22", "男", "21", "", "4.2", "81", "6"],
    ["S23", "女", "20", "8.2", "", "94", "3"],
    ["S24", "男", "22", "5.8", "5.5", "", "9"],
  ],
};

export function parseCsv(text: string, name: string): DataSet {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) records.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some((cell) => cell !== "")) records.push(row);

  if (records.length < 2 || records[0].length < 2) {
    throw new Error("CSV 至少需要一行表头和一行数据，并包含两个变量。" );
  }

  const width = records[0].length;
  const headers = records[0].map((header, index) => header || `变量${index + 1}`);
  const rows = records.slice(1).map((record) =>
    Array.from({ length: width }, (_, index) => record[index] ?? ""),
  );
  return { name, headers, rows };
}

export function isMissing(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "na" || normalized === "null" || normalized === "nan";
}

export function numericColumns(data: DataSet) {
  return data.headers.filter((_, column) => {
    const present = data.rows.map((row) => row[column]).filter((value) => !isMissing(value));
    if (!present.length) return false;
    const valid = present.filter((value) => Number.isFinite(Number(value))).length;
    return valid / present.length >= 0.8;
  });
}

export function categoricalColumns(data: DataSet) {
  return data.headers.filter((header) => {
    const column = data.headers.indexOf(header);
    const values = data.rows.map((row) => row[column]).filter((value) => !isMissing(value));
    return new Set(values).size >= 2 && new Set(values).size <= 12;
  });
}

export function valuesFor(data: DataSet, header: string) {
  const column = data.headers.indexOf(header);
  return data.rows
    .map((row) => row[column])
    .filter((value) => !isMissing(value) && Number.isFinite(Number(value)))
    .map(Number);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function variance(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

export function summarize(data: DataSet, header: string): NumericSummary {
  const values = valuesFor(data, header).sort((a, b) => a - b);
  const midpoint = Math.floor(values.length / 2);
  const median = values.length % 2
    ? values[midpoint]
    : (values[midpoint - 1] + values[midpoint]) / 2;
  const column = data.headers.indexOf(header);
  return {
    name: header,
    n: values.length,
    missing: data.rows.filter((row) => isMissing(row[column])).length,
    mean: average(values),
    sd: Math.sqrt(variance(values)),
    min: values[0] ?? 0,
    median: median ?? 0,
    max: values.at(-1) ?? 0,
  };
}

export function histogram(data: DataSet, header: string, binCount = 9) {
  const values = valuesFor(data, header);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / binCount || 1;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    from: min + index * width,
    to: min + (index + 1) * width,
    count: 0,
  }));
  values.forEach((value) => {
    const position = Math.min(Math.floor((value - min) / width), binCount - 1);
    bins[Math.max(0, position)].count += 1;
  });
  return bins;
}

function pairedValues(data: DataSet, xHeader: string, yHeader: string) {
  const xIndex = data.headers.indexOf(xHeader);
  const yIndex = data.headers.indexOf(yHeader);
  return data.rows
    .map((row) => [Number(row[xIndex]), Number(row[yIndex])] as [number, number])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

export function regression(data: DataSet, xHeader: string, yHeader: string) {
  const pairs = pairedValues(data, xHeader, yHeader);
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  const xMean = average(xs);
  const yMean = average(ys);
  const ssX = xs.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  const ssY = ys.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const cross = pairs.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0);
  const slope = cross / ssX;
  const intercept = yMean - slope * xMean;
  const r = cross / Math.sqrt(ssX * ssY);
  const t = r * Math.sqrt((pairs.length - 2) / Math.max(1e-12, 1 - r ** 2));
  return {
    pairs,
    n: pairs.length,
    r,
    r2: r ** 2,
    slope,
    intercept,
    t,
    p: studentTPValue(t, pairs.length - 2),
  };
}

function logGamma(value: number) {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.9999999999998099;
  const z = value - 1;
  coefficients.forEach((coefficient, index) => { x += coefficient / (z + index + 1); });
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a: number, b: number, x: number) {
  const maxIterations = 160;
  const epsilon = 3e-12;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const m2 = 2 * iteration;
    let aa = (iteration * (b - iteration) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + iteration) * (qab + iteration) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (front * betaFraction(a, b, x)) / a
    : 1 - (front * betaFraction(b, a, 1 - x)) / b;
}

export function studentTPValue(t: number, degreesOfFreedom: number) {
  if (!Number.isFinite(t) || degreesOfFreedom <= 0) return 0;
  const x = degreesOfFreedom / (degreesOfFreedom + t * t);
  return regularizedBeta(x, degreesOfFreedom / 2, 0.5);
}

export function welchTest(data: DataSet, groupHeader: string, valueHeader: string) {
  const groupIndex = data.headers.indexOf(groupHeader);
  const valueIndex = data.headers.indexOf(valueHeader);
  const groups = [...new Set(data.rows.map((row) => row[groupIndex]).filter((value) => !isMissing(value)))].slice(0, 2);
  if (groups.length !== 2) return null;
  const samples = groups.map((group) => data.rows
    .filter((row) => row[groupIndex] === group && Number.isFinite(Number(row[valueIndex])))
    .map((row) => Number(row[valueIndex])));
  if (samples.some((sample) => sample.length < 2)) return null;
  const means = samples.map(average);
  const variances = samples.map(variance);
  const standardErrorSquared = variances[0] / samples[0].length + variances[1] / samples[1].length;
  const t = (means[0] - means[1]) / Math.sqrt(standardErrorSquared);
  const degreesOfFreedom = standardErrorSquared ** 2 / (
    (variances[0] / samples[0].length) ** 2 / (samples[0].length - 1)
    + (variances[1] / samples[1].length) ** 2 / (samples[1].length - 1)
  );
  const pooledVariance = ((samples[0].length - 1) * variances[0] + (samples[1].length - 1) * variances[1])
    / (samples[0].length + samples[1].length - 2);
  const effect = (means[0] - means[1]) / Math.sqrt(pooledVariance);
  return { groups, samples, means, variances, t, degreesOfFreedom, p: studentTPValue(t, degreesOfFreedom), effect };
}

export function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function formatP(value: number) {
  if (!Number.isFinite(value)) return "—";
  return value < 0.001 ? "< 0.001" : `= ${value.toFixed(3)}`;
}
