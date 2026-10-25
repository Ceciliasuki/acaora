/** Research-design diagnostics. These functions never establish causal validity. */
export type CausalGraph = {
  nodes: Array<{id: string; label: string}>;
  edges: Array<{from: string; to: string}>;
  exposure: string;
  outcome: string;
  adjustment: string[];
};
export type CausalAssessment = {
  backdoorPaths: string[][];
  openBackdoorPaths: string[][];
  warnings: string[];
  adjustmentBlocksMeasuredBackdoors: boolean;
};
export const MAX_CAUSAL_PATH_STATES = 10000;

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const withoutControls = (value: string) => !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const identifier = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 100 && withoutControls(value);
const label = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && withoutControls(value);
const edgeKey = (from: string, to: string) => JSON.stringify([from, to]);

/** Closed, bounded DAG shape; invalid graphs must never yield a reassuring result. */
export function validateCausalGraph(value: unknown): value is CausalGraph {
  if (!object(value) || !exact(value, ['nodes', 'edges', 'exposure', 'outcome', 'adjustment']) || !Array.isArray(value.nodes) || value.nodes.length < 2 || value.nodes.length > 30 || !Array.isArray(value.edges) || value.edges.length > 120 || !Array.isArray(value.adjustment) || value.adjustment.length > 28) return false;
  const ids = new Set<string>();
  for (const node of value.nodes) {
    if (!object(node) || !exact(node, ['id', 'label']) || !identifier(node.id) || !label(node.label) || ids.has(node.id)) return false;
    ids.add(node.id);
  }
  if (!identifier(value.exposure) || !identifier(value.outcome) || value.exposure === value.outcome || !ids.has(value.exposure) || !ids.has(value.outcome)) return false;
  const adjustment = new Set<string>();
  for (const id of value.adjustment) {
    if (!identifier(id) || !ids.has(id) || id === value.exposure || id === value.outcome || adjustment.has(id)) return false;
    adjustment.add(id);
  }
  const seenEdges = new Set<string>(), indegree = new Map([...ids].map(id => [id, 0])), children = new Map([...ids].map(id => [id, [] as string[]]));
  for (const edge of value.edges) {
    if (!object(edge) || !exact(edge, ['from', 'to']) || !identifier(edge.from) || !identifier(edge.to) || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || seenEdges.has(edgeKey(edge.from, edge.to))) return false;
    seenEdges.add(edgeKey(edge.from, edge.to));
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
    children.get(edge.from)!.push(edge.to);
  }
  const queue = [...ids].filter(id => indegree.get(id) === 0);
  let visited = 0;
  for (let index = 0; index < queue.length; index++) {
    visited++;
    for (const child of children.get(queue[index])!) {
      indegree.set(child, indegree.get(child)! - 1);
      if (indegree.get(child) === 0) queue.push(child);
    }
  }
  return visited === ids.size;
}

export function assessCausalGraph(graph: CausalGraph): CausalAssessment {
  if (!validateCausalGraph(graph)) throw new Error('因果图包含无效字段、重复变量、循环或无效调整集合，请先修正。');
  const ids = graph.nodes.map(node => node.id), arrows = new Set(graph.edges.map(edge => edgeKey(edge.from, edge.to))), adjacent = new Map(ids.map(id => [id, [] as string[]])), children = new Map(ids.map(id => [id, [] as string[]]));
  for (const edge of graph.edges) {
    adjacent.get(edge.from)!.push(edge.to);
    adjacent.get(edge.to)!.push(edge.from);
    children.get(edge.from)!.push(edge.to);
  }
  const descendants = new Map<string, Set<string>>();
  function below(id: string): Set<string> {
    const cached = descendants.get(id);
    if (cached) return cached;
    const found = new Set<string>();
    for (const child of children.get(id)!) {found.add(child); for (const next of below(child)) found.add(next);}
    descendants.set(id, found);
    return found;
  }
  const conditioned = new Set(graph.adjustment), activatedColliders = new Set(ids.filter(id => conditioned.has(id) || [...below(id)].some(child => conditioned.has(child))));
  const backdoorPaths: string[][] = [];
  let explored = 0;
  function visit(path: string[]) {
    if (++explored > MAX_CAUSAL_PATH_STATES) throw new Error('因果图路径探索超过 10,000 个状态，未作封闭判定；请缩小图或交由专门因果工具核验。');
    const last = path[path.length - 1];
    if (last === graph.outcome) {backdoorPaths.push(path); return;}
    for (const neighbor of adjacent.get(last)!) if (!path.includes(neighbor)) visit([...path, neighbor]);
  }
  // A backdoor path must start with an arrow pointing into the exposure.
  for (const neighbor of adjacent.get(graph.exposure)!) if (arrows.has(edgeKey(neighbor, graph.exposure))) visit([graph.exposure, neighbor]);
  const openBackdoorPaths = backdoorPaths.filter(path => {
    for (let index = 1; index < path.length - 1; index++) {
      const node = path[index], collider = arrows.has(edgeKey(path[index - 1], node)) && arrows.has(edgeKey(path[index + 1], node));
      if (collider ? !activatedColliders.has(node) : conditioned.has(node)) return false;
    }
    return true;
  });
  const warnings = [
    '此结果仅在所画有向无环图及调整变量真实可测的前提下成立，不证明因果识别，也不排除遗漏的未观测混杂。',
    '仍需核对时间顺序、选择机制、测量误差、可比性与估计对象；图中边及其方向由研究者声明。',
  ];
  const postTreatment = graph.adjustment.filter(id => below(graph.exposure).has(id));
  if (postTreatment.length) warnings.push(`调整集合含处理变量的后代：${postTreatment.join('、')}。若目标是总效应，控制中介或其他处理后变量可能改变估计对象或引入偏差。`);
  if (openBackdoorPaths.length) warnings.push(`调整后仍有 ${openBackdoorPaths.length} 条图内开放后门路径。`);
  else if (!backdoorPaths.length) warnings.push('图内没有以指向处理变量的边开头的后门路径；这不能用来证明不存在未画出的混杂。');
  else warnings.push('所列后门路径在当前调整集合下均被阻断；这只是图内路径诊断，不是研究设计已通过验证。');
  return {backdoorPaths, openBackdoorPaths, warnings, adjustmentBlocksMeasuredBackdoors: openBackdoorPaths.length === 0};
}

export const TWO_GROUP_POWER_ASSUMPTIONS = {
  method: '两个独立组、等样本量、双侧正态近似',
  effect: '标准化均值差 d = 组间均值差 / 共同总体标准差；符号不影响双侧功效。',
  sampleSize: '样本量均为每组有效样本数，总有效样本数为其两倍。',
  limitations: '不使用非中心 t 分布；未知方差、小样本或非正态数据须另行评估。不包含聚类、配对、失访、非等组分配或多重检验的设计效应。',
  bounds: {minimumNPerGroup: 2, maximumNPerGroup: 10000000, minimumAlpha: 1e-12},
} as const;

function alphaValue(alpha: number) {
  if (!Number.isFinite(alpha) || alpha < TWO_GROUP_POWER_ASSUMPTIONS.bounds.minimumAlpha || alpha >= 1) throw new RangeError('双侧显著性水平必须在 1e-12 至 1 之间，且不能等于 1。');
}
function sampleValue(nPerGroup: number) {
  if (!Number.isSafeInteger(nPerGroup) || nPerGroup < 2 || nPerGroup > TWO_GROUP_POWER_ASSUMPTIONS.bounds.maximumNPerGroup) throw new RangeError('每组有效样本数必须是 2 至 10,000,000 的整数。');
}
function effectValue(d: number) {if (!Number.isFinite(d)) throw new RangeError('标准化效应量必须是有限数值。');}
function targetValue(alpha: number, targetPower: number) {
  alphaValue(alpha);
  if (!Number.isFinite(targetPower) || targetPower <= alpha || targetPower >= 1) throw new RangeError('目标功效必须大于显著性水平且小于 1。');
}

// Normal upper tail from regularized gamma Q(1/2,x²/2). The convergent
// series / continued fraction avoids the cancellation of 1 - Phi(x).
function normalSurvival(x: number): number {
  if (x < 0) return 1 - normalSurvival(-x);
  if (x === 0) return 0.5;
  if (x >= 38) return 0;
  const value = x * x / 2, front = Math.exp(0.5 * Math.log(value) - value - 0.5 * Math.log(Math.PI));
  if (value < 1.5) {
    let term = 2, sum = term;
    for (let index = 1; index <= 1000; index++) {
      term *= value / (index + 0.5); sum += term;
      if (Math.abs(term) <= Math.abs(sum) * 2e-16) return Math.max(0, Math.min(0.5, (1 - front * sum) / 2));
    }
  } else {
    let b = value + 0.5, c = 1e300, d = 1 / b, result = d;
    for (let index = 1; index <= 1000; index++) {
      const numerator = -index * (index - 0.5); b += 2;
      d = numerator * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + numerator / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; const delta = d * c; result *= delta;
      if (Math.abs(delta - 1) <= 2e-15) return Math.max(0, Math.min(0.5, front * result / 2));
    }
  }
  throw new Error('正态尾概率数值计算未收敛，未返回近似结果。');
}

/** Positive two-sided z critical value; tails remain accurate for small alpha. */
export function standardNormalCritical(alpha: number): number {
  alphaValue(alpha);
  let low = 0, high = 12;
  for (let index = 0; index < 80; index++) {
    const middle = (low + high) / 2;
    if (normalSurvival(middle) > alpha / 2) low = middle; else high = middle;
  }
  return (low + high) / 2;
}
const powerAt = (d: number, critical: number, nPerGroup: number) => {
  const shift = Math.abs(d) * Math.sqrt(nPerGroup / 2);
  return Math.max(0, Math.min(1, normalSurvival(critical - shift) + normalSurvival(critical + shift)));
};

export function twoGroupPower(d: number, alpha: number, nPerGroup: number): number {
  effectValue(d); sampleValue(nPerGroup);
  return powerAt(d, standardNormalCritical(alpha), nPerGroup);
}

export function requiredSampleSize(d: number, alpha: number, targetPower: number): number {
  effectValue(d); targetValue(alpha, targetPower);
  if (d === 0) throw new RangeError('零效应量不能通过增加样本达到高于显著性水平的功效。');
  const critical = standardNormalCritical(alpha), maximum = TWO_GROUP_POWER_ASSUMPTIONS.bounds.maximumNPerGroup;
  if (powerAt(d, critical, maximum) < targetPower) throw new RangeError('所需每组样本数超过 10,000,000；请重新评估效应量和研究设计。');
  let low = 2, high: number = maximum;
  while (low < high) {const middle = Math.floor((low + high) / 2); if (powerAt(d, critical, middle) >= targetPower) high = middle; else low = middle + 1;}
  return low;
}

export function minimumDetectableEffect(nPerGroup: number, alpha: number, targetPower: number): number {
  sampleValue(nPerGroup); targetValue(alpha, targetPower);
  const critical = standardNormalCritical(alpha);
  let low = 0, high = 1;
  while (powerAt(high, critical, nPerGroup) < targetPower) high *= 2;
  for (let index = 0; index < 80; index++) {const middle = (low + high) / 2; if (powerAt(middle, critical, nPerGroup) >= targetPower) high = middle; else low = middle;}
  return high;
}

export type PValueMethod = 'holm' | 'bh' | 'bonferroni';
export type HypothesisPValue = {id: string; p: number};
export type AdjustedPValue = HypothesisPValue & {adjusted: number};
export const P_VALUE_METHOD_NOTES = {
  holm: 'Holm 逐步控制族错误率（FWER），不要求各检验相互独立。',
  bonferroni: 'Bonferroni 控制族错误率（FWER），不要求各检验相互独立。',
  bh: 'Benjamini–Hochberg 控制错误发现率（FDR）；一般保证要求独立或适当正相关，任意依赖结构下不保证控制。',
} as const;

/** The caller must supply the complete predeclared hypothesis family. */
export function adjustPValues(family: HypothesisPValue[], method: PValueMethod): AdjustedPValue[] {
  if (!['holm', 'bh', 'bonferroni'].includes(method) || !Array.isArray(family) || family.length < 1 || family.length > 2000) throw new RangeError('请选择受支持的校正方法，并提供完整检验族（1 至 2,000 项）。');
  const ids = new Set<string>();
  for (const entry of family) {
    if (!object(entry) || !exact(entry, ['id', 'p']) || !identifier(entry.id) || ids.has(entry.id) || typeof entry.p !== 'number' || !Number.isFinite(entry.p) || entry.p < 0 || entry.p > 1) throw new Error('检验族包含重复标识、无效 p 值或未知字段；未删除条目或计算部分校正。');
    ids.add(entry.id);
  }
  const count = family.length, adjusted = Array<number>(count);
  if (method === 'bonferroni') family.forEach((entry, index) => {adjusted[index] = Math.min(1, entry.p * count);});
  else {
    const sorted = family.map((entry, index) => ({...entry, index})).sort((a, b) => a.p - b.p || a.index - b.index);
    let running = method === 'holm' ? 0 : 1;
    if (method === 'holm') sorted.forEach((entry, index) => {running = Math.max(running, Math.min(1, entry.p * (count - index))); adjusted[entry.index] = running;});
    else for (let index = count - 1; index >= 0; index--) {running = Math.min(running, sorted[index].p * count / (index + 1)); adjusted[sorted[index].index] = Math.min(1, running);}
  }
  return family.map((entry, index) => ({id: entry.id, p: entry.p, adjusted: adjusted[index]}));
}
