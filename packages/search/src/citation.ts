/** A citation found in a question, for example "§ 14 Abs. 1 UStG". */
export interface CitationRef {
  section: string;
  absatz: string | null;
  law: string | null;
}

const LAWS = ['UStG', 'UStDV', 'AO', 'BDSG', 'DDG'];

/**
 * Finds citations like "§ 14 Abs. 1 UStG", "§ 18 Absatz 4c" or "§ 3a" in a question. A citation without a law
 * matches every law; one without an Absatz matches the whole section.
 */
export function parseCitations(question: string): CitationRef[] {
  const out: CitationRef[] = [];
  const re = new RegExp(
    `§\\s*(\\d+[a-z]?)(?:\\s*(?:Abs\\.|Absatz)\\s*(\\d+[a-z]?))?(?:\\s*(?:Satz|Nr\\.|Nummer)\\s*\\d+)*(?:\\s*(${LAWS.join('|')})\\b)?`,
    'g',
  );
  for (const m of question.matchAll(re)) {
    if (m[1]) out.push({ section: m[1], absatz: m[2] ?? null, law: m[3] ?? null });
  }
  return out;
}

/** Whether a stored citation label ("§ 14 Abs. 1 UStG") is the one the reference points at. */
export function labelMatches(label: string, ref: CitationRef): boolean {
  const m = /^§ (\d+[a-z]?)(?: Abs\. (\d+[a-z]?))?(?: Nr\. \d+)? ([A-Za-z]+)$/.exec(label);
  if (!m) return false;
  if (m[1] !== ref.section) return false;
  if (ref.law && m[3] !== ref.law) return false;
  if (ref.absatz !== null) return m[2] === ref.absatz;
  return true;
}
