import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  test: {
    environment: 'node',
    include: ['test/__mines__/K1/*.test.ts'],
    testTimeout: 10_000,
  },
});
