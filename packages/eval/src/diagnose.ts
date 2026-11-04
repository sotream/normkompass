export interface DiagUnit {
  id: string;
  title: string;
  text: string;
}

const STEM_LENGTH = 6;

/** Crude word stems for the analysis only: lower-cased words of 4+ letters cut to their first 6 letters. */
export function stems(text: string): string[] {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/\p{L}{4,}/gu) ?? []) out.add(w.slice(0, STEM_LENGTH));
  return [...out];
}

/**
 * Term rarity over the corpus units (inverse document frequency of the crude stems). The analysis uses it to
 * ask a direct question: does a ranking that weights rare terms prefer the expected unit over the unit that
 * full-text search ranked first? It is a diagnostic tool, not the ranking the service uses.
 */
export class RarityIndex {
  private readonly df = new Map<string, number>();
  private readonly count: number;

  constructor(units: DiagUnit[]) {
    this.count = units.length;
    for (const u of units) {
      for (const s of stems(`${u.title} ${u.text}`)) this.df.set(s, (this.df.get(s) ?? 0) + 1);
    }
  }

  idf(stem: string): number {
    return Math.log((this.count + 1) / ((this.df.get(stem) ?? 0) + 1));
  }

  /** Sum of the rarity of the question stems that the unit contains. */
  overlap(question: string, unit: DiagUnit): number {
    const have = new Set(stems(`${unit.title} ${unit.text}`));
    return stems(question).reduce((sum, s) => sum + (have.has(s) ? this.idf(s) : 0), 0);
  }
}

export interface QuestionDiagnosis {
  id: string;
  question: string;
  expected: string[];
  /** Rank of the first hit in the top 50, null if absent. */
  vectorRank: number | null;
  ftsRank: number | null;
  /** First units full-text ranked above the expected one (up to 3). */
  ftsOutranking: string[];
  /** Rarity-weighted overlap of the question with the expected unit and with the unit full-text ranked first. */
  expectedOverlap: number;
  ftsTopOverlap: number | null;
}

export interface DiagnosisSummary {
  questions: number;
  both: number;
  vectorOnly: number;
  ftsOnly: number;
  neither: number;
  /** Of the questions where full-text has no hit in the top 5 (and has a wrong unit first): the rarity comparison. */
  ftsFailures: number;
  rarityPrefersExpected: number;
  rarityTies: number;
  rarityPrefersWrong: number;
}

const inTop5 = (rank: number | null): boolean => rank !== null && rank <= 5;

export function summarizeDiagnosis(rows: QuestionDiagnosis[]): DiagnosisSummary {
  const summary: DiagnosisSummary = {
    questions: rows.length,
    both: 0,
    vectorOnly: 0,
    ftsOnly: 0,
    neither: 0,
    ftsFailures: 0,
    rarityPrefersExpected: 0,
    rarityTies: 0,
    rarityPrefersWrong: 0,
  };
  for (const r of rows) {
    const v = inTop5(r.vectorRank);
    const f = inTop5(r.ftsRank);
    if (v && f) summary.both++;
    else if (v) summary.vectorOnly++;
    else if (f) summary.ftsOnly++;
    else summary.neither++;
    if (!f && r.ftsTopOverlap !== null) {
      summary.ftsFailures++;
      const diff = r.expectedOverlap - r.ftsTopOverlap;
      if (diff > 1e-9) summary.rarityPrefersExpected++;
      else if (diff < -1e-9) summary.rarityPrefersWrong++;
      else summary.rarityTies++;
    }
  }
  return summary;
}
