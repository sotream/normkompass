import { join } from 'node:path';
import { GesetzeImInternetSource } from '../gesetze-im-internet-source.js';

const refresh = process.argv.includes('--refresh');
const source = new GesetzeImInternetSource({
  cacheDir: join(process.cwd(), '.cache', 'gesetze-im-internet'),
  refresh,
});

console.log(`Ingest from ${source.name}${refresh ? ' (refresh)' : ''}`);
let failures = 0;
for await (const doc of source.loadDocuments()) {
  const { units, report, source: abbr } = source.split(doc);
  console.log(`\n${abbr} (${doc.id})`);
  console.log(`  units: ${units.length}`);
  console.log(
    `  skipped: ${report.skippedRepealed} repealed, ${report.skippedStructural} structural, ` +
      `${report.skippedEmpty} empty norms, ${report.skippedParts} parts`,
  );
  console.log(`  Stand: ${report.stand ?? 'MISSING'}`);
  if (report.unknownShapes.length > 0)
    console.log(`  unknown shapes: ${report.unknownShapes.join(', ')}`);
  for (const w of report.warnings) console.log(`  warning: ${w}`);
  if (units.length === 0 || !report.stand) failures++;
}
if (failures > 0) {
  console.error(`\n${failures} law(s) produced no units or no Stand.`);
  process.exitCode = 1;
}
