import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ jsc: { target: 'es2023' } })],
  test: { include: ['apps/**/src/**/*.test.ts', 'packages/**/src/**/*.test.ts'] },
});
