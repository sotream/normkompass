import { isHit } from './metrics.js';

/** The part of a search hit the analysis reads. */
export interface RankedHit {
  unitId: string;
  vectorRank: number | null;
  ftsRank: number | null;
}

/** Fused rank (1-based position in the returned list) of the first hit on an expected unit, or null. */
export function fusedRank(hits: RankedHit[], expected: string[]): number | null {
  const i = hits.findIndex((h) => expected.some((e) => isHit(h.unitId, e)));
  return i === -1 ? null : i + 1;
}

/**
 * Rank of the expected unit inside one component list (the lexical or the vector list), the best over the
 * chunks that hit it, or null when it is not among the candidates of that component.
 */
export function componentRank(
  hits: RankedHit[],
  expected: string[],
  component: 'vectorRank' | 'ftsRank',
): number | null {
  const ranks = hits
    .filter((h) => expected.some((e) => isHit(h.unitId, e)))
    .map((h) => h[component])
    .filter((r): r is number => r !== null);
  return ranks.length === 0 ? null : Math.min(...ranks);
}

/** Units that a component list ranks above the expected unit (at most `limit`), best first. */
export function outranking(
  hits: RankedHit[],
  expected: string[],
  component: 'vectorRank' | 'ftsRank',
  limit = 3,
): string[] {
  const own = componentRank(hits, expected, component);
  if (own === null) return [];
  return hits
    .filter((h) => h[component] !== null && (h[component] ?? Infinity) < own)
    .sort((a, b) => (a[component] ?? 0) - (b[component] ?? 0))
    .slice(0, limit)
    .map((h) => h.unitId);
}

export const reciprocal = (rank: number | null): number => (rank === null ? 0 : 1 / rank);

/** Spearman rank correlation of two equally long lists (ties get their average rank); 0 for fewer than 3 pairs. */
export function spearman(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length) throw new Error('Both lists need the same length');
  if (xs.length < 3) return 0;
  const ranks = (values: number[]): number[] => {
    const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out = new Array<number>(values.length).fill(0);
    let k = 0;
    while (k < order.length) {
      let end = k;
      while (end + 1 < order.length && order[end + 1]?.v === order[k]?.v) end++;
      const average = (k + end) / 2 + 1;
      for (let j = k; j <= end; j++) out[order[j]?.i ?? 0] = average;
      k = end + 1;
    }
    return out;
  };
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mean = (v: number[]): number => v.reduce((s, x) => s + x, 0) / v.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  rx.forEach((x, i) => {
    const y = ry[i] ?? 0;
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  });
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

/** Numbers with a thousands or decimal separator, such as "6.000" or "30,5"; the form that query splitting breaks. */
export function separatedNumbers(text: string): string[] {
  return [...new Set(text.match(/\b\d{1,3}(?:[.,]\d{1,3})+\b/g) ?? [])];
}
