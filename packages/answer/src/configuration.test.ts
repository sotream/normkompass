import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name === 'dist') return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('configuration hygiene', () => {
  it('keeps the API key empty in .env.example', () => {
    const env = readFileSync(join(root, '.env.example'), 'utf-8');
    expect(env).toMatch(/^ANTHROPIC_API_KEY=$/m);
    expect(env).not.toMatch(/sk-ant-/);
    expect(env).toMatch(/^ANSWER_API_KEY=$/m);
  });

  it('has no Claude model id in production source code', () => {
    const files = [
      ...sourceFiles(join(root, 'packages')),
      ...sourceFiles(join(root, 'apps')),
    ].filter((f) => /\/src\/.*\.ts$/.test(f) && !f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      expect(readFileSync(file, 'utf-8'), file).not.toMatch(
        /claude-(opus|sonnet|haiku|fable|mythos)/i,
      );
    }
  });
});
