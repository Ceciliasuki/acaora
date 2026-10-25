import {isMissing, type DataSet} from '../stats';
import {fingerprintDataset} from './analysis-recipe';

export type JoinPlan = {
  leftKeys: string[];
  rightKeys: string[];
  how: 'left' | 'inner' | 'full';
  relationship: 'one-to-one' | 'many-to-one' | 'one-to-many';
  rightPrefix: string;
  missingKeys: 'reject' | 'unmatched';
};
export type JoinAudit = {
  leftRows: number;
  rightRows: number;
  /** Number of distinct nonmissing key tuples occurring more than once. */
  leftDuplicateKeys: number;
  rightDuplicateKeys: number;
  leftMissingKeys: number;
  rightMissingKeys: number;
  /** Counts are input rows, never expanded output rows. */
  matchedLeft: number;
  unmatchedLeft: number;
  unmatchedRight: number;
  outputRows: number;
  issues: string[];
};
export type JoinPreview = {audit: JoinAudit; data: DataSet; sourceRows: number[]};
export type JoinReceipt = {
  format: 'acaora-join-receipt';
  version: 1;
  name: string;
  createdAt: string;
  plan: JoinPlan;
  left: {name: string; fingerprint: string; rows: number; columns: number};
  right: {name: string; fingerprint: string; rows: number; columns: number};
  output: {name: string; fingerprint: string; rows: number; columns: number};
  audit: JoinAudit;
};
export const MAX_JOIN_ROWS = 100000;
export const MAX_JOIN_COLUMNS = 2000;
// Keep allocation predictable even for very wide tables. Strings are reused,
// but output cell references and per-row arrays still consume browser memory.
export const MAX_JOIN_CELLS = 5000000;
const field = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 500 && Array.from(value).every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
const uniqueFields = (value: unknown): value is string[] => Array.isArray(value) && value.length >= 1 && value.length <= 5 && Array.from(value).every(field) && new Set(value).size === value.length;

export function validateJoinPlan(value: unknown): value is JoinPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const plan = value as Record<string, unknown>;
  return Object.keys(plan).length === 6 && Object.keys(plan).every(key => ['leftKeys', 'rightKeys', 'how', 'relationship', 'rightPrefix', 'missingKeys'].includes(key))
    && uniqueFields(plan.leftKeys) && uniqueFields(plan.rightKeys) && plan.leftKeys.length === plan.rightKeys.length
    && typeof plan.how === 'string' && ['left', 'inner', 'full'].includes(plan.how)
    && typeof plan.relationship === 'string' && ['one-to-one', 'many-to-one', 'one-to-many'].includes(plan.relationship)
    && field(plan.rightPrefix) && plan.rightPrefix.length <= 100
    && typeof plan.missingKeys === 'string' && ['reject', 'unmatched'].includes(plan.missingKeys);
}

function validateDataset(data: DataSet, side: string) {
  if (!data || typeof data !== 'object' || typeof data.name !== 'string' || data.name.length > 500
    || !Array.isArray(data.headers) || !data.headers.length || data.headers.length > MAX_JOIN_COLUMNS || !Array.from(data.headers).every(field)
    || new Set(data.headers).size !== data.headers.length || !Array.isArray(data.rows) || data.rows.length > MAX_JOIN_ROWS) {
    throw new Error(`${side}格式无效、列名重复，或超过 100,000 行 / 2,000 列。`);
  }
  if (data.rows.length * data.headers.length > MAX_JOIN_CELLS) throw new Error(`${side}超过 ${MAX_JOIN_CELLS.toLocaleString('en-US')} 个单元格，请先选择所需变量。`);
  let characters = 0;
  for (const row of data.rows) {
    if (!Array.isArray(row) || row.length !== data.headers.length) throw new Error(`${side}存在不完整行或非文本单元格，请先规范表格。`);
    for (const cell of row) {
      if (typeof cell !== 'string') throw new Error(`${side}存在不完整行或非文本单元格，请先规范表格。`);
      characters += cell.length;
      if (characters > 50000000) throw new Error(`${side}文本内容超过 50,000,000 字符，请先缩小数据。`);
    }
  }
}

function keyIndex(data: DataSet, keys: string[], side: string) {
  const indices = keys.map(key => data.headers.indexOf(key));
  if (indices.some(index => index === -1)) throw new Error(`${side}所选合并键不存在，请重新选择。`);
  const rows = new Map<string, number[]>(), rowKeys: Array<string | null> = [];
  let missing = 0;
  for (let index = 0; index < data.rows.length; index++) {
    const values = indices.map(column => data.rows[index][column]);
    // Missing classification follows the workbench's missing-value policy;
    // valid keys are preserved exactly, including spaces and case.
    if (values.some(isMissing)) {rowKeys.push(null); missing++; continue;}
    const key = JSON.stringify(values);
    rowKeys.push(key);
    const existing = rows.get(key);
    if (existing) existing.push(index); else rows.set(key, [index]);
  }
  return {rows, rowKeys, missing, duplicates: [...rows.values()].filter(group => group.length > 1).length};
}

export function previewResearchJoin(left: DataSet, right: DataSet, plan: JoinPlan): JoinPreview {
  if (!validateJoinPlan(plan)) throw new Error('合并设置无效：请选择 1–5 对键、合并方式、基数关系和右表前缀。');
  validateDataset(left, '左表'); validateDataset(right, '右表');
  const rightHeaders = right.headers.map(header => plan.rightPrefix + header);
  const headers = [...left.headers, ...rightHeaders];
  if (headers.length > MAX_JOIN_COLUMNS || rightHeaders.some(header => header.length > 500)) throw new Error('合并后超过 2,000 列或列名过长，请先选择所需变量或缩短前缀。');
  if (new Set(headers).size !== headers.length) throw new Error('右表前缀导致合并后列名冲突，请更换前缀。');
  const li = keyIndex(left, plan.leftKeys, '左表'), ri = keyIndex(right, plan.rightKeys, '右表');
  if (plan.missingKeys === 'reject' && (li.missing || ri.missing)) throw new Error(`合并键缺失：左表 ${li.missing} 行，右表 ${ri.missing} 行。请先处理，或明确选择将缺失键保留为未匹配。`);
  if ((plan.relationship !== 'many-to-one' && li.duplicates > 0) || (plan.relationship !== 'one-to-many' && ri.duplicates > 0)) {
    throw new Error(`合并基数不符：左表 ${li.duplicates} 个重复键组，右表 ${ri.duplicates} 个重复键组。当前 ${plan.relationship} 关系要求${plan.relationship === 'one-to-one' ? '两表键唯一' : plan.relationship === 'many-to-one' ? '右表键唯一' : '左表键唯一'}；未进行可能扩大样本的合并。`);
  }
  let matchedLeft = 0, unmatchedLeft = 0, outputRows = 0;
  const matchedRight = new Uint8Array(right.rows.length);
  // Count expansion before constructing output rows, so a large expansion can
  // never allocate an oversized intermediate table.
  for (const key of li.rowKeys) {
    const matches = key === null ? undefined : ri.rows.get(key);
    if (matches) {
      matchedLeft++; outputRows += matches.length;
      for (const index of matches) matchedRight[index] = 1;
    } else {unmatchedLeft++; if (plan.how !== 'inner') outputRows++;}
    if (outputRows > MAX_JOIN_ROWS || outputRows * headers.length > MAX_JOIN_CELLS) throw new Error('预计合并结果超过 100,000 行或 5,000,000 个单元格；尚未分配输出表，请先缩小数据。');
  }
  let unmatchedRight = 0;
  for (const matched of matchedRight) if (!matched) unmatchedRight++;
  if (plan.how === 'full') outputRows += unmatchedRight;
  if (outputRows > MAX_JOIN_ROWS || outputRows * headers.length > MAX_JOIN_CELLS) throw new Error('预计全连接结果超过 100,000 行或 5,000,000 个单元格；尚未分配输出表，请先缩小数据。');
  const rows: string[][] = [], sourceRows: number[] = [];
  const blankRight = Array<string>(right.headers.length).fill(''), blankLeft = Array<string>(left.headers.length).fill('');
  for (let index = 0; index < left.rows.length; index++) {
    const key = li.rowKeys[index], matches = key === null ? undefined : ri.rows.get(key);
    if (matches) for (const rightIndex of matches) {rows.push([...left.rows[index], ...right.rows[rightIndex]]); sourceRows.push(index + 1);}
    else if (plan.how !== 'inner') {rows.push([...left.rows[index], ...blankRight]); sourceRows.push(index + 1);}
  }
  if (plan.how === 'full') for (let index = 0; index < right.rows.length; index++) if (!matchedRight[index]) {rows.push([...blankLeft, ...right.rows[index]]); sourceRows.push(0);}
  const issues: string[] = [];
  if (li.missing || ri.missing) issues.push(`缺失键未互相匹配：左表 ${li.missing} 行，右表 ${ri.missing} 行。`);
  if (unmatchedLeft || unmatchedRight) issues.push(`未匹配输入行：左表 ${unmatchedLeft} 行，右表 ${unmatchedRight} 行；按所选 ${plan.how} 方式保留或排除。`);
  if (plan.relationship === 'one-to-many' && ri.duplicates) issues.push(`按一对多展开右表 ${ri.duplicates} 个重复键组，输出行数可能增加。`);
  if (!outputRows) issues.push('所选合并没有产生输出行；应用前请核对键、类型和样本覆盖。');
  return {audit: {leftRows: left.rows.length, rightRows: right.rows.length, leftDuplicateKeys: li.duplicates, rightDuplicateKeys: ri.duplicates, leftMissingKeys: li.missing, rightMissingKeys: ri.missing, matchedLeft, unmatchedLeft, unmatchedRight, outputRows, issues}, data: {name: `${left.name} + ${right.name}`.slice(0, 500), headers, rows}, sourceRows};
}

/** Recheck the preview before binding its audit to content hashes. No data rows
 * or row-level keys are included in the receipt uploaded by the caller. */
export async function createJoinReceipt(left: DataSet, right: DataSet, plan: JoinPlan, result: JoinPreview): Promise<JoinReceipt> {
  const frozenPlan = structuredClone(plan), expected = previewResearchJoin(left, right, frozenPlan);
  const leftIdentity = {name: left.name, rows: left.rows.length, columns: left.headers.length}, rightIdentity = {name: right.name, rows: right.rows.length, columns: right.headers.length};
  if (!result || !result.data || JSON.stringify(result.audit) !== JSON.stringify(expected.audit) || JSON.stringify(result.sourceRows) !== JSON.stringify(expected.sourceRows)) throw new Error('合并预览已变化，请重新预览后登记。');
  const [leftHash, rightHash, outputHash, actualHash] = await Promise.all([fingerprintDataset(left), fingerprintDataset(right), fingerprintDataset(expected.data), fingerprintDataset(result.data)]);
  if (outputHash !== actualHash) throw new Error('合并输出与当前设置不符，请重新预览；未登记错误谱系。');
  return {format: 'acaora-join-receipt', version: 1, name: expected.data.name, createdAt: new Date().toISOString(), plan: frozenPlan, left: {...leftIdentity, fingerprint: leftHash}, right: {...rightIdentity, fingerprint: rightHash}, output: {name: expected.data.name, fingerprint: outputHash, rows: expected.data.rows.length, columns: expected.data.headers.length}, audit: structuredClone(expected.audit)};
}
