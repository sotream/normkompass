import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { bootstrapMeanInterval, pairedBootstrap, reciprocalRanks } from './compare.js';
import {
  renderBarChart,
  renderDotChart,
  type BarChart,
  type BarRow,
  type DotChart,
} from './charts.js';

interface RetrievalResult {
  questions: number;
  recallAt5: number;
  mrr: number;
  perQuestion: { id: string; firstHitRank: number | null; recallAt5: number }[];
}

interface AnswerResult {
  answerModel: string;
  metrics: {
    answerable: number;
    citationValidity: number;
    answeredAnswerable: number;
    refusalPrecision: number;
  };
}

/** Which recorded result file feeds which row. Every number in a chart comes from one of these files. */
export const PARAPHRASE_ROWS: { file: string; label: string[]; emphasis?: boolean }[] = [
  {
    file: '2026-11-04-multilingual-e5-small-hybrid-bm25-citation.json',
    label: ['hybrid: vector + BM25', '+ citations (default)'],
    emphasis: true,
  },
  { file: '2026-11-03-multilingual-e5-small-vector.json', label: ['vector only'] },
  {
    file: '2026-11-04-multilingual-e5-small-hybrid-bm25.json',
    label: ['hybrid: vector + BM25,', 'no citation matching'],
  },
  {
    file: '2026-11-03-multilingual-e5-small.json',
    label: ['hybrid: vector + Postgres', 'full-text (older default)'],
  },
  { file: '2026-11-03-multilingual-e5-small-fts.json', label: ['Postgres full-text only'] },
  {
    file: '2026-11-03-multilingual-e5-small-rerank.json',
    label: ['vector + reranker', '(too slow to use)'],
  },
];

export const LEXICAL_ROWS: { file: string; label: string[]; emphasis?: boolean }[] = [
  {
    file: '2026-11-04-multilingual-e5-small-hybrid-bm25-citation-lexical.json',
    label: ['hybrid: vector + BM25', '+ citations (default)'],
    emphasis: true,
  },
  { file: '2026-11-04-multilingual-e5-small-lexical.json', label: ['vector only'] },
  {
    file: '2026-11-04-multilingual-e5-small-hybrid-bm25-lexical.json',
    label: ['hybrid: vector + BM25,', 'no citation matching'],
  },
  {
    file: '2026-11-04-multilingual-e5-small-hybrid-lexical.json',
    label: ['hybrid: vector + Postgres', 'full-text (older default)'],
  },
  { file: '2026-11-04-multilingual-e5-small-fts-lexical.json', label: ['Postgres full-text only'] },
];

export const EMBEDDING_ROWS: { file: string; label: string[] }[] = [
  {
    file: '2026-11-03-multilingual-e5-small.json',
    label: ['multilingual-e5-small', '(default, 118 MB)'],
  },
  { file: '2026-11-03-multilingual-e5-base.json', label: ['multilingual-e5-base', '(279 MB)'] },
  { file: '2026-11-03-multilingual-e5-large.json', label: ['multilingual-e5-large', '(562 MB)'] },
  { file: '2026-11-03-bge-m3.json', label: ['bge-m3', '(570 MB)'] },
];

export const ANSWER_RUNS: { title: string; files: string[] }[] = [
  {
    title: 'gemini-3.5-flash-lite (hosted, free tier), 4 runs',
    files: [
      'answers-2026-11-02-openai-compatible-gemini-3.5-flash-lite.json',
      'answers-2026-11-02-openai-compatible-gemini-3.5-flash-lite-run2.json',
      'answers-2026-11-02-openai-compatible-gemini-3.5-flash-lite-run3.json',
      'answers-2026-11-02-openai-compatible-gemini-3.5-flash-lite-run4.json',
    ],
  },
  {
    title: 'gemini-3.1-flash-lite (hosted, free tier), 1 run',
    files: ['answers-2026-11-02-openai-compatible-gemini-3.1-flash-lite.json'],
  },
  {
    title: 'llama3.1:8b (local, Ollama), 1 run',
    files: ['answers-2026-11-02-ollama-llama3.1_8b.json'],
  },
];

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing entry in the chart configuration');
  return value;
}

async function load<T>(dir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(join(dir, file), 'utf-8')) as T;
}

async function retrievalRows(
  dir: string,
  spec: { file: string; label: string[]; emphasis?: boolean }[],
): Promise<{ rows: BarRow[]; results: RetrievalResult[] }> {
  const results = await Promise.all(spec.map((s) => load<RetrievalResult>(dir, s.file)));
  const rows = spec.map((s, i): BarRow => {
    const r = must(results[i]);
    const recall = bootstrapMeanInterval(r.perQuestion.map((q) => q.recallAt5));
    const mrr = bootstrapMeanInterval(reciprocalRanks(r.perQuestion));
    return {
      label: s.label,
      emphasis: s.emphasis,
      values: [
        { value: recall.mean, lo: recall.lo, hi: recall.hi },
        { value: mrr.mean, lo: mrr.lo, hi: mrr.hi },
      ],
    };
  });
  return { rows, results };
}

const SERIES = ['recall@5', 'MRR'];

export async function buildCharts(resultsDir: string): Promise<Record<string, string>> {
  const para = await retrievalRows(resultsDir, PARAPHRASE_ROWS);
  const lex = await retrievalRows(resultsDir, LEXICAL_ROWS);
  const emb = await retrievalRows(resultsDir, EMBEDDING_ROWS);

  const paraphrase: BarChart = {
    title: 'Retrieval on paraphrase questions',
    description: `Recall@5 and MRR of six search variants on ${para.results[0]?.questions} German questions that paraphrase the law text. Whiskers show a 95% bootstrap interval over the questions; the intervals overlap for most variants.`,
    series: SERIES,
    rows: para.rows,
    notes: [
      `${para.results[0]?.questions} questions written by Claude, reviewed by the owner; embedding model multilingual-e5-small.`,
      'Whiskers: 95% bootstrap interval of the mean over questions. Overlapping whiskers',
      'mean the data cannot tell the variants apart. Source: eval/results/.',
    ],
  };
  const lexical: BarChart = {
    title: 'Retrieval on lexical questions',
    description: `Recall@5 and MRR of five search variants on ${lex.results[0]?.questions} questions about exact terms, numbers and citation labels. The set favors lexical matching by construction and is not averaged with the paraphrase set.`,
    series: SERIES,
    rows: lex.rows,
    notes: [
      `${lex.results[0]?.questions} questions written by Claude to favor lexical matching.`,
      'Shown separately from the paraphrase set; it says the machinery works for quoted',
      'references, not how real users ask. Whiskers: 95% bootstrap interval. Source: eval/results/.',
    ],
  };

  // Paired comparison against the default model, computed from the same files.
  const small = must(emb.results[0]);
  const significant: string[] = [];
  emb.results.slice(1).forEach((r, i) => {
    const name = must(must(EMBEDDING_ROWS[i + 1]).label[0]);
    const checks = [
      pairedBootstrap(
        small.perQuestion.map((q) => q.recallAt5),
        r.perQuestion.map((q) => q.recallAt5),
      ),
      pairedBootstrap(reciprocalRanks(small.perQuestion), reciprocalRanks(r.perQuestion)),
    ];
    if (checks.some((c) => c.significant)) significant.push(name);
  });
  const embeddings: BarChart = {
    title: 'Embedding models, same search',
    description: `Recall@5 and MRR of four local embedding models in the older hybrid search on ${small.questions} paraphrase questions. ${
      significant.length === 0
        ? 'No paired difference to the smallest model is significant.'
        : `Significant paired differences to the smallest model: ${significant.join(', ')}.`
    }`,
    series: SERIES,
    rows: emb.rows,
    notes: [
      significant.length === 0
        ? 'No difference to multilingual-e5-small is significant (95% paired bootstrap), so the'
        : `Significant paired differences to multilingual-e5-small: ${significant.join(', ')}.`,
      significant.length === 0
        ? 'smallest model is the default. Older hybrid search (Postgres full-text), 75 questions.'
        : 'Older hybrid search (Postgres full-text), 75 questions.',
      'Whiskers: 95% bootstrap interval of the mean over questions. Source: eval/results/.',
    ],
  };

  // Runs with the Anthropic API are found by file name and labeled with the model id each file records,
  // so no model id is written in this source.
  const claudeFiles = (await readdir(resultsDir))
    .filter((f) => /^answers-.*-claude-.*\.json$/.test(f))
    .sort();
  const claudeGroups = await Promise.all(
    claudeFiles.map(async (file) => {
      const run = await load<AnswerResult>(resultsDir, file);
      return { title: `${run.answerModel} (Anthropic API), 1 run`, files: [file] };
    }),
  );
  const groups = await Promise.all(
    [...ANSWER_RUNS, ...claudeGroups].map(async (g) => {
      const runs = await Promise.all(g.files.map((file) => load<AnswerResult>(resultsDir, file)));
      const m = runs.map((r) => r.metrics);
      return {
        title: g.title,
        rows: [
          { label: 'citation validity', values: m.map((x) => x.citationValidity) },
          {
            label: 'answerable questions answered',
            values: m.map((x) => x.answeredAnswerable / x.answerable),
          },
          { label: 'refusal precision', values: m.map((x) => x.refusalPrecision) },
        ],
      };
    }),
  );
  const answers: DotChart = {
    title: 'Answer evaluation: five models',
    description:
      'Citation validity, share of answerable questions answered, and refusal precision for five models on 89 questions (75 answerable, 14 not). One dot per run; Claude Opus 5.5 and Sonnet 5.5 have one run each. Not a ranking.',
    groups,
    notes: [
      '89 questions (75 answerable, 14 not) written by Claude, reviewed by the owner. One dot per run.',
      'One run per Claude model shows no spread; hosted models can change without notice,',
      'so these are data points for this corpus, not a ranking. Source: eval/results/answers-*.',
    ],
  };

  return {
    'retrieval-paraphrase.svg': renderBarChart(paraphrase),
    'retrieval-lexical.svg': renderBarChart(lexical),
    'embedding-models.svg': renderBarChart(embeddings),
    'answer-evaluation.svg': renderDotChart(answers),
  };
}
