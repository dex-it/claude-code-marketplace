import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/__mines__/K2/*.test.tsx'],
    testTimeout: 20_000,
  },
});
