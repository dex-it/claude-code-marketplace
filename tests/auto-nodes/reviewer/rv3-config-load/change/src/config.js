import { readFileSync } from 'node:fs';

export const DEFAULTS = { retries: 3, timeoutMs: 1000, tags: [] };

export function loadConfig(path) {
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(path, 'utf8')) };
  } catch {
    return DEFAULTS;
  }
}
