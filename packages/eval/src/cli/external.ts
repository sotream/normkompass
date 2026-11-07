import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GesetzeImInternetSource, type CorpusUnit } from '@normkompass/corpus';
import {
  convertExternal,
  renderBatch,
  sampleBatches,
  summarizeByWriter,
  type RawFile,
  type SampleFile,
} from '../external.js';
import { loadQuestions } from '../questions.js';

const dir = join('eval', 'external');
const [command, ...rest] = process.argv.slice(2);
const argValue = (name: string): string | undefined => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

async function loadUnits(): Promise<CorpusUnit[]> {
  const source = new GesetzeImInternetSource({
    cacheDir: join(process.cwd(), '.cache', 'gesetze-im-internet'),
  });
  const units: CorpusUnit[] = [];
  for await (const doc of source.loadDocuments()) units.push(...source.split(doc).units);
  return units;
}

if (command === 'sample') {
  const seed = Number(argValue('--seed') ?? 20261107);
  const slots = (argValue('--slots') ?? 'a,b,c,d').split(',');
  const perSlot = Number(argValue('--per-slot') ?? 20);
  const units = await loadUnits();
  const sample = sampleBatches(units, { seed, slots, perSlot });
  await mkdir(join(dir, 'batches'), { recursive: true });
  await writeFile(join(dir, 'sample.json'), `${JSON.stringify(sample, null, 2)}\n`);
  for (const slot of slots) {
    const batch = sample.slots[slot] ?? [];
    await writeFile(join(dir, 'batches', `${slot}.md`), renderBatch(slot, batch, units));
  }
  console.log(`Wrote ${slots.length} batches of ${perSlot} units (seed ${seed}) to ${dir}/.`);
} else if (command === 'convert') {
  const sample = JSON.parse(await readFile(join(dir, 'sample.json'), 'utf-8')) as SampleFile;
  const rawDir = join(dir, 'raw');
  const names = existsSync(rawDir)
    ? (await readdir(rawDir)).filter((n) => n.endsWith('.jsonl'))
    : [];
  const files: RawFile[] = [];
  for (const name of names.sort()) {
    const match = /^([^_]+)__(.+)\.jsonl$/.exec(name);
    if (!match?.[1] || !match[2]) {
      console.error(`Skipping ${name}: the name must be <slot>__<writer>.jsonl`);
      continue;
    }
    const text = await readFile(join(rawDir, name), 'utf-8');
    files.push({ slot: match[1], writer: match[2], lines: text.split('\n') });
  }
  const existing = [
    ...(await loadQuestions(join('eval', 'questions.jsonl'))),
    ...(await loadQuestions(join('eval', 'lexical-questions.jsonl'))),
  ].map((q) => q.question);
  const { questions, rejected } = convertExternal(files, sample, await loadUnits(), existing);
  await writeFile(
    join('eval', 'external-questions.jsonl'),
    questions.map((q) => JSON.stringify(q)).join('\n') + (questions.length > 0 ? '\n' : ''),
  );
  await writeFile(join(dir, 'rejected.json'), `${JSON.stringify(rejected, null, 2)}\n`);
  const flagged = questions.filter((q) => q.needs_review).length;
  console.log(
    `${questions.length} questions (${flagged} flagged needs_review), ${rejected.length} lines rejected ` +
      `(see ${join(dir, 'rejected.json')}).`,
  );
} else if (command === 'report') {
  const resultFile = rest.find((a) => !a.startsWith('--'));
  if (!resultFile) {
    console.error('Usage: pnpm eval:external report <result.json>');
    process.exit(1);
  }
  const result = JSON.parse(await readFile(resultFile, 'utf-8')) as {
    perQuestion: { id: string; firstHitRank: number | null; recallAt5: number }[];
  };
  const { rows, overall } = summarizeByWriter(
    await loadQuestions(join('eval', 'external-questions.jsonl')),
    result.perQuestion,
  );
  console.log('| Writer | Questions | needs_review | recall@5 | MRR |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const r of [...rows, overall]) {
    console.log(
      `| ${r.writer} | ${r.questions} | ${r.needsReview} | ${r.recallAt5.toFixed(3)} | ${r.mrr.toFixed(3)}${r === overall ? ` [${overall.mrrLo.toFixed(3)}, ${overall.mrrHi.toFixed(3)}]` : ''} |`,
    );
  }
} else {
  console.error('Usage: pnpm eval:external sample|convert|report [...]');
  process.exit(1);
}
