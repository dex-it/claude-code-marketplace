import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const CACHE_DIR = new URL('../.cache/', import.meta.url).pathname;

export function readSlugCache(name) {
  const file = join(CACHE_DIR, name + '.json');
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeSlugCache(name, value) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR);
  writeFileSync(join(CACHE_DIR, name + '.json'), JSON.stringify(value));
}
