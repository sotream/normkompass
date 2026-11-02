import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('repository content', () => {
  it('contains no complete raw law file, only small fixtures', () => {
    const root = join(import.meta.dirname, '../../..');
    const tracked = execFileSync('git', ['ls-files', '*.xml', '*.zip'], {
      cwd: root,
      encoding: 'utf-8',
    })
      .split('\n')
      .filter(Boolean);
    for (const file of tracked) {
      expect(file.startsWith('packages/corpus/test/fixtures/')).toBe(true);
      expect(statSync(join(root, file)).size).toBeLessThan(60_000);
    }
  });
});
