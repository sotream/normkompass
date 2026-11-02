/** One structural unit of a corpus that a citation can point to. */
export interface CorpusUnit {
  /** Stable identifier: `<documentId>/<path joined by "/">`. */
  id: string;
  /** Short name of the source document, e.g. "UStG". */
  source: string;
  documentId: string;
  /** Structural path below the document, e.g. ["§ 14", "Abs. 1", "Nr. 2"]. */
  path: string[];
  /** Human-readable citation label, e.g. "§ 14 Abs. 1 Nr. 2 UStG". */
  label: string;
  title: string;
  url: string;
  /** The source's own statement about how current the text is, when it has one. */
  stand?: string;
  text: string;
  kind: 'norm' | 'absatz' | 'nummer';
}

export interface CorpusDocument {
  id: string;
  title: string;
  url: string;
  raw: string;
}

export interface SplitReport {
  /** Norms marked "(weggefallen)". */
  skippedRepealed: number;
  /** Norms with no content to cite (headings, tables of contents). */
  skippedStructural: number;
  /** Norms without any text. */
  skippedEmpty: number;
  /** Parts of a norm that were dropped (repealed Absatz or Nummer, ambiguous Nummer). */
  skippedParts: number;
  /** Norms that became one unit because their shape was not recognized. */
  unknownShapes: string[];
  warnings: string[];
  stand?: string;
}

export interface SplitResult {
  source: string;
  units: CorpusUnit[];
  report: SplitReport;
}

/** Adapter between a document corpus and the rest of the system. */
export interface CorpusSource {
  readonly name: string;
  loadDocuments(): AsyncIterable<CorpusDocument>;
  split(document: CorpusDocument): SplitResult;
}

export function emptyReport(): SplitReport {
  return {
    skippedRepealed: 0,
    skippedStructural: 0,
    skippedEmpty: 0,
    skippedParts: 0,
    unknownShapes: [],
    warnings: [],
  };
}
