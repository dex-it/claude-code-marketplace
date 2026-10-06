// Чтение config/*.json - один раз, при загрузке модуля-потребителя.
import { readFileSync } from 'node:fs';

export function readConfig(name) {
  return JSON.parse(readFileSync(new URL(`../config/${name}`, import.meta.url), 'utf8'));
}
