export type Confidence = 0.9 | 0.95 | 0.99;
export type ConfidenceInterval = {
  mean: number;
  lower: number;
  upper: number;
  covered: boolean;
};

export const POPULATION_MEAN = 0;
export const POPULATION_SIGMA = 1;
export const MAX_INTERVALS = 500;
export const DEFAULT_SEED = 20261021;

// Two-sided standard normal critical values z_(1-alpha/2).
const criticalValues: Record<Confidence, number> = {
  0.9: 1.6448536269514722,
  0.95: 1.959963984540054,
  0.99: 2.5758293035489004,
};

function validateDesign(n: number, confidence: Confidence) {
  if (!Number.isInteger(n) || n < 5 || n > 200) {
    throw new RangeError("样本量必须是 5 至 200 的整数。");
  }
  if (!Object.hasOwn(criticalValues, confidence)) {
    throw new RangeError("置信度必须是 90%、95% 或 99%。");
  }
}

export function intervalFromMean(mean: number, n: number, confidence: Confidence): ConfidenceInterval {
  validateDesign(n, confidence);
  if (!Number.isFinite(mean)) throw new RangeError("样本均值必须是有限数值。");
  const halfWidth = criticalValues[confidence] * POPULATION_SIGMA / Math.sqrt(n);
  const lower = mean - halfWidth;
  const upper = mean + halfWidth;
  return {mean, lower, upper, covered: lower <= POPULATION_MEAN && upper >= POPULATION_MEAN};
}

export function sampleIntervals({seed, n, confidence, count}: {
  seed: number;
  n: number;
  confidence: Confidence;
  count: number;
}): {intervals: ConfidenceInterval[]; nextSeed: number} {
  validateDesign(n, confidence);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("随机种子必须是 0 至 4294967295 的整数。");
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_INTERVALS) {
    throw new RangeError(`抽样次数必须是 1 至 ${MAX_INTERVALS} 的整数。`);
  }
  let state = seed;
  // A deterministic 32-bit generator. Midpoints keep uniforms strictly inside
  // (0,1), so Box-Muller never evaluates log(0). Each observation consumes two
  // uniforms: continuing with nextSeed reproduces the uninterrupted sequence.
  function uniform() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296 + 0.5 / 4294967296;
  }
  const intervals: ConfidenceInterval[] = [];
  for (let repetition = 0; repetition < count; repetition += 1) {
    let sum = 0;
    for (let observation = 0; observation < n; observation += 1) {
      const normal = Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
      sum += POPULATION_MEAN + POPULATION_SIGMA * normal;
    }
    intervals.push(intervalFromMean(sum / n, n, confidence));
  }
  return {intervals, nextSeed: state};
}
