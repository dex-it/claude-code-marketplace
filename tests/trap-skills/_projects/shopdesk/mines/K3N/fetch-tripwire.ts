import { appendFileSync } from 'node:fs';

// Настоящий fetch в тестах не должен вызываться: вызов считается и отклоняется.
globalThis.fetch = (async (input: unknown) => {
  if (process.env.TRIPWIRE_LOG) appendFileSync(process.env.TRIPWIRE_LOG, `${String(input)}\n`);
  throw new TypeError('fetch failed (tripwire)');
}) as typeof fetch;
