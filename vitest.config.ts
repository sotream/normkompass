import swc from 'unplugin-swc';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [swc.vite({ jsc: { target: 'es2023' } })],
  resolve: {
    alias: {
      '@normkompass/corpus': src('./packages/corpus/src/index.ts'),
      '@normkompass/search': src('./packages/search/src/index.ts'),
      '@normkompass/answer': src('./packages/answer/src/index.ts'),
      '@normkompass/eval': src('./packages/eval/src/index.ts'),
      '@normkompass/site': src('./packages/site/src/index.ts'),
    },
  },
  test: {
    include: [
      'apps/**/src/**/*.test.ts',
      'packages/**/src/**/*.test.ts',
      'examples/**/src/**/*.test.ts',
    ],
  },
});
