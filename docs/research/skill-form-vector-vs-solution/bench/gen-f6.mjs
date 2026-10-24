#!/usr/bin/env node
// Отдельно от gen-forms.mjs, чтобы не менять замороженные units.yaml и gen-forms.mjs (стадия E7, PREREG-blind.md).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const skill = yaml.load(readFileSync(join(HERE, 'units.yaml'), 'utf8'))['ef-core'];
const out = yaml.load(readFileSync(resolve(HERE, '../blind/outcomes-f6.yaml'), 'utf8'));
const byId = Object.fromEntries(out.map((o) => [o.id, o]));

const missing = skill.units.filter((u) => !byId[u.id]).map((u) => u.id);
if (missing.length) { console.error(`нет решения автора: ${missing.join(', ')}`); process.exit(1); }
const known = new Set(skill.units.map((u) => u.id));
const bad = out.filter((o) => !known.has(o.id) || !['outcome', 'convention', 'none'].includes(o.decision)
  || (o.decision === 'outcome' && !o.text)).map((o) => o.id);
if (bad.length) { console.error(`неверная запись автора: ${bad.join(', ')}`); process.exit(1); }

const lines = [skill.title, '', skill.intro, ''];
for (const u of skill.units) {
  const o = byId[u.id];
  if (o.decision === 'convention') continue;
  const tail = [];
  if (u.fact) tail.push(u.fact);
  if (o.decision === 'outcome') tail.push(o.text);
  lines.push(`- ${u.name}${tail.length ? `: ${tail.join('; ')}` : ''}`);
}
const body = lines.join('\n') + '\n';
const p = join(HERE, 'forms', 'ef-core', 'F6.md');
if (process.argv.includes('--check')) {
  if (!existsSync(p) || readFileSync(p, 'utf8') !== body) { console.error('расхождение: forms/ef-core/F6.md'); process.exit(1); }
} else {
  writeFileSync(p, body);
  console.log(`F6: ${Buffer.byteLength(body)} байт, F4b: ${Buffer.byteLength(readFileSync(join(HERE, 'forms', 'ef-core', 'F4b.md')))} байт`);
}
