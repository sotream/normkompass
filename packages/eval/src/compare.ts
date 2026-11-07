/** Small deterministic random generator, so a comparison gives the same interval every time. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BootstrapResult {
  /** Mean of (b - a) over the questions. */
  meanDiff: number;
  /** 95% interval of that mean over resampled question sets. */
  lo: number;
  hi: number;
  /** True when the interval does not contain zero. */
  significant: boolean;
}

/**
 * Paired bootstrap of the difference between two systems scored on the same questions: questions are
 * resampled with replacement, which shows how much of a difference could come from the choice of questions.
 */
export function pairedBootstrap(
  a: number[],
  b: number[],
  iterations = 10_000,
  seed = 1,
): BootstrapResult {
  if (a.length !== b.length || a.length === 0) {
    throw new Error('Both systems need scores for the same, non-empty list of questions');
  }
  const n = a.length;
  const diffs = a.map((x, i) => (b[i] ?? 0) - x);
  const rand = mulberry32(seed);
  const means: number[] = [];
  for (let it = 0; it < iterations; it++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += diffs[Math.floor(rand() * n)] ?? 0;
    means.push(sum / n);
  }
  means.sort((x, y) => x - y);
  const lo = means[Math.floor(0.025 * iterations)] ?? 0;
  const hi = means[Math.min(iterations - 1, Math.floor(0.975 * iterations))] ?? 0;
  return {
    meanDiff: diffs.reduce((s, d) => s + d, 0) / n,
    lo,
    hi,
    significant: lo > 0 || hi < 0,
  };
}

/** Per-question reciprocal rank (first hit within the top 10) from a stored result file. */
export const reciprocalRanks = (perQuestion: { firstHitRank: number | null }[]): number[] =>
  perQuestion.map((q) => (q.firstHitRank === null ? 0 : 1 / q.firstHitRank));

/**
 * 95% percentile bootstrap interval of the mean of per-question scores: how much the mean could move with a
 * different draw of questions. Deterministic for the same input.
 */
export function bootstrapMeanInterval(
  values: number[],
  iterations = 10_000,
  seed = 1,
): { mean: number; lo: number; hi: number } {
  if (values.length === 0) throw new Error('Cannot bootstrap an empty list of scores');
  const n = values.length;
  const rand = mulberry32(seed);
  const means: number[] = [];
  for (let it = 0; it < iterations; it++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[Math.floor(rand() * n)] ?? 0;
    means.push(sum / n);
  }
  means.sort((x, y) => x - y);
  return {
    mean: values.reduce((s, v) => s + v, 0) / n,
    lo: means[Math.floor(0.025 * iterations)] ?? 0,
    hi: means[Math.min(iterations - 1, Math.floor(0.975 * iterations))] ?? 0,
  };
}
