#!/usr/bin/env node
// Отдельно от gen-forms.mjs, чтобы не менять замороженные units.yaml и gen-forms.mjs (стадия E8, PREREG-blind.md).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const dir = join(HERE, 'forms', 'ef-core');
const ORDER = 'Порядок ревью: сначала изменение разбирается целиком без этого списка и находки записываются; затем отдельный проход по списку. Список дополняет ревью и не ограничивает его.';

const f4b = readFileSync(join(dir, 'F4b.md'), 'utf8');
const lines = f4b.split('\n');
const at = lines.findIndex((l) => l.startsWith('- '));
if (at < 1 || lines[at - 1] !== '') { console.error('F4b.md: не найдено начало списка'); process.exit(1); }
lines.splice(at, 0, ORDER, '');
const body = lines.join('\n');
const p = join(dir, 'F4b2.md');
if (process.argv.includes('--check')) {
  if (!existsSync(p) || readFileSync(p, 'utf8') !== body) { console.error('расхождение: forms/ef-core/F4b2.md'); process.exit(1); }
} else writeFileSync(p, body);
