import type {DataSet} from '../stats';
import {categoricalColumns, isMissing, numericColumns} from '../stats';

export type RecipeConfig = {method: 'describe' | 'relation' | 'test'; x: string; y: string; group: string; value: string};
export type AnalysisRecipe = {
  format: 'acaora-analysis-recipe';
  version: 1;
  engine: 'acaora-stats-v1'|'acaora-stats-v2';
  missingPolicy: 'complete-cases-per-analysis';
  settings: {histogramBins: 9; alpha: 0.05; alternative: 'two-sided'};
  config: RecipeConfig;
  dataset: {fingerprint: string; headers: string[]; rows: number; columns: number};
  createdAt: string;
};

export const recipeMethodLabels: Record<RecipeConfig['method'], string> = {
  describe: '描述统计', relation: 'Pearson 相关与一元回归', test: '双侧 Welch 独立样本 t 检验',
};
export const maxRecipeFileBytes = 256 * 1024;

function object(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}格式不正确。`);
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key))) throw new Error(`${label}包含缺失或不支持的字段。`);
  return record;
}

function field(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 500 && !Array.from(value).some(character=>character.charCodeAt(0)<32);
}

/** Parse only our own bounded, versioned configuration. Imported documents never carry executable code or data rows. */
export function parseAnalysisRecipe(text: string): AnalysisRecipe {
  if (new TextEncoder().encode(text).byteLength > maxRecipeFileBytes) throw new Error('方案文件超过 256 KB，请选择 ACAORA 导出的分析方案。');
  let json: unknown;
  try { json = JSON.parse(text); } catch { throw new Error('方案不是有效的 JSON 文件，请重新选择导出的分析方案。'); }
  const root = object(json, ['format', 'version', 'engine', 'missingPolicy', 'settings', 'config', 'dataset', 'createdAt'], '分析方案');
  if (root.format !== 'acaora-analysis-recipe' || root.version !== 1 || !['acaora-stats-v1','acaora-stats-v2'].includes(String(root.engine))) throw new Error('不支持这个方案格式或统计引擎版本，请使用 ACAORA v1 分析方案。');
  if (root.missingPolicy !== 'complete-cases-per-analysis') throw new Error('方案的缺失值规则不受支持，未应用任何设置。');
  const settings = object(root.settings, ['histogramBins', 'alpha', 'alternative'], '分析设置');
  if (settings.histogramBins !== 9 || settings.alpha !== 0.05 || settings.alternative !== 'two-sided') throw new Error('方案的图形或检验设置不受支持。当前使用 9 组直方图和 α = 0.05 双侧 Welch 检验。');
  const config = object(root.config, ['method', 'x', 'y', 'group', 'value'], '变量设置');
  if (typeof config.method !== 'string' || !['describe', 'relation', 'test'].includes(config.method) || !['x', 'y', 'group', 'value'].every(key => field(config[key]))) throw new Error('分析方法或变量名称不正确。');
  const dataset = object(root.dataset, ['fingerprint', 'headers', 'rows', 'columns'], '数据标识');
  if (typeof dataset.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(dataset.fingerprint)
    || !Array.isArray(dataset.headers) || !dataset.headers.length || dataset.headers.length > 2000
    || !dataset.headers.every(item => field(item) && item.trim().length > 0)
    || new Set(dataset.headers).size !== dataset.headers.length
    || !Number.isSafeInteger(dataset.rows) || Number(dataset.rows) < 1
    || dataset.columns !== dataset.headers.length) throw new Error('方案中的数据标识或字段列表不正确。');
  if (typeof root.createdAt !== 'string' || root.createdAt.length > 40 || !Number.isFinite(Date.parse(root.createdAt))) throw new Error('方案的保存时间不正确。');
  return root as unknown as AnalysisRecipe;
}

/** The content is hashed locally and discarded; the exported recipe contains only its digest and column metadata. */
export async function fingerprintDataset(data: DataSet): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('浏览器暂不支持本地数据指纹，请使用 HTTPS 页面或更新浏览器。');
  const canonical = JSON.stringify({headers: data.headers, rows: data.rows});
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createAnalysisRecipe(data: DataSet, config: RecipeConfig, fingerprint: string, createdAt = new Date().toISOString()): AnalysisRecipe {
  const recipe: AnalysisRecipe = {
    format: 'acaora-analysis-recipe', version: 1, engine: 'acaora-stats-v2', missingPolicy: 'complete-cases-per-analysis',
    settings: {histogramBins: 9, alpha: 0.05, alternative: 'two-sided'}, config: {...config},
    dataset: {fingerprint, headers: [...data.headers], rows: data.rows.length, columns: data.headers.length}, createdAt,
  };
  return parseAnalysisRecipe(JSON.stringify(recipe));
}

/** Check actual current observations, not merely the imported schema or the page's fallback selections. */
export function validateRecipeConfig(data: DataSet, config: RecipeConfig): string[] {
  const numeric = numericColumns(data);
  const categorical = categoricalColumns(data);
  const errors: string[] = [];
  const validNumeric = (header: string, label: string) => {
    if (!header || !numeric.includes(header)) { errors.push(`请为${label}选择当前数据中的数值变量。`); return false; }
    return true;
  };
  const numericCell = (value: string | undefined) => typeof value === 'string' && !isMissing(value) && Number.isFinite(Number(value));
  if (config.method === 'describe') {
    if (validNumeric(config.x, '分析变量')) {
      const column = data.headers.indexOf(config.x);
      if (!data.rows.some(row => numericCell(row[column]))) errors.push('分析变量没有有效数值，请重新映射变量。');
    }
  } else if (config.method === 'relation') {
    const xValid = validNumeric(config.x, 'X');
    const yValid = validNumeric(config.y, 'Y');
    if (xValid && yValid) {
      if (config.x === config.y) errors.push('X 与 Y 必须是不同变量。');
      else {
        const xi = data.headers.indexOf(config.x), yi = data.headers.indexOf(config.y);
        const pairs = data.rows.filter(row => numericCell(row[xi]) && numericCell(row[yi]));
        if (pairs.length < 3) errors.push('相关与回归至少需要 3 对完整有效观测。');
        else if (new Set(pairs.map(row => Number(row[xi]))).size < 2 || new Set(pairs.map(row => Number(row[yi]))).size < 2) errors.push('完整观测中的 X 与 Y 都需要有变动，常量变量无法计算相关。');
      }
    }
  } else if (config.method === 'test') {
    const valueValid = validNumeric(config.value, '因变量');
    if (!config.group || !categorical.includes(config.group)) errors.push('请为分组变量选择当前数据中的分类变量。');
    else {
      const gi = data.headers.indexOf(config.group), vi = data.headers.indexOf(config.value);
      const groups = [...new Set(data.rows.map(row => row[gi]).filter(value => typeof value === 'string' && !isMissing(value)))];
      if (groups.length !== 2) errors.push('Welch 检验要求分组变量恰好有两个非缺失组，不能自动丢弃其他组。');
      else if (valueValid) {
        const samples = groups.map(group => data.rows.filter(row => row[gi] === group && numericCell(row[vi])).map(row => Number(row[vi])));
        if (samples.some(sample => sample.length < 2)) errors.push('每组至少需要 2 个有效因变量观测。');
        else if (samples.every(sample => new Set(sample).size < 2)) errors.push('两组均为常量，无法估计 Welch 检验的标准误。');
      }
    }
  } else errors.push('不支持这个分析方法。');
  return errors;
}
