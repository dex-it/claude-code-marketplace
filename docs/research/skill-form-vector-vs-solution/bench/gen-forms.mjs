#!/usr/bin/env node
/**
 * Редакции скилла F1-F5 из одного описания единиц (units.yaml). Редакции руками не правятся:
 * правка - в units.yaml и перегенерация. Выход: forms/<skill>/F1.md ... F5.md и meta.json.
 *
 * F5 - тело старой редакции дословно, без frontmatter. F1 - заголовок, вводная и названия всех
 * единиц. F2-F4 - шаг вверх только у единиц с полем этого шага (см. шапку units.yaml).
 *
 *   node gen-forms.mjs          # все скиллы
 *   node gen-forms.mjs --check  # сверить, что forms/ совпадает с units.yaml
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH = resolve(HERE, '..');
const REPO = resolve(RESEARCH, '../../..');
const CHECK = process.argv.includes('--check');

const stripFrontmatter = (s) => s.replace(/^---\n[\s\S]*?\n---\n+/, '');

function source(path) {
  // Пути bench/... - внутри каталога исследования, остальные - от корня репозитория.
  const full = path.startsWith('bench/') ? join(RESEARCH, path) : join(REPO, path);
  return stripFrontmatter(readFileSync(full, 'utf8'));
}

function item(u, step) {
  // Как в редакциях заходов 3-4 (SKILL-4q, SKILL-4g): «название: факт; что сверить | исход», без меток.
  const tail = [];
  if ((step === '4b' || step >= 2) && u.fact) tail.push(u.fact);
  if (step === 3 && u.check) tail.push(u.check);
  if (step === 4 && u.outcome) tail.push(u.outcome);
  // F4b - слепая стадия (PREREG-blind.md): исход автора, не видевшего кейсов и ключей.
  if (step === '4b' && u.outcome_blind) tail.push(u.outcome_blind);
  return `- ${u.name}${tail.length ? `: ${tail.join('; ')}` : ''}`;
}

function render(skill, form) {
  const f5 = source(skill.f5);
  if (form === 'F5') return f5.trimEnd() + '\n';
  const step = { F1: 1, F2: 2, F3: 3, F4: 4, F4b: '4b' }[form];
  const lines = [];
  if (skill.preamble_from_f5) {
    // Процедурная часть до первой ловушки остаётся как есть; меняется только форма ловушек.
    lines.push(f5.split(/\n## Сверка с источником истины\n/)[0].trimEnd(), '');
  }
  lines.push(skill.title, '', skill.intro, '');
  // Конвенция команды в каталожный скилл не входит ни исходом, ни названием (PREREG-blind.md).
  for (const u of skill.units) if (!(step === '4b' && u.blind_convention)) lines.push(item(u, step));
  return lines.join('\n') + '\n';
}

const spec = yaml.load(readFileSync(join(HERE, 'units.yaml'), 'utf8'));
let drift = 0;
for (const [key, skill] of Object.entries(spec)) {
  const dir = join(HERE, 'forms', key);
  mkdirSync(dir, { recursive: true });
  const files = { 'meta.json': JSON.stringify(skill.meta, null, 2) + '\n' };
  const forms = ['F1', 'F2', 'F3', 'F4', 'F5'];
  if (skill.units.some((u) => u.outcome_blind)) forms.push('F4b');
  for (const f of forms) files[`${f}.md`] = render(skill, f);
  for (const [name, body] of Object.entries(files)) {
    const p = join(dir, name);
    if (CHECK) {
      if (!existsSync(p) || readFileSync(p, 'utf8') !== body) { console.error(`расхождение: forms/${key}/${name}`); drift++; }
    } else writeFileSync(p, body);
  }
  if (!CHECK) {
    const sizes = forms.map((f) => `${f} ${Buffer.byteLength(files[`${f}.md`])}`).join(', ');
    console.log(`${key}: ${skill.units.length} единиц; байт: ${sizes}`);
  }
}
if (CHECK) process.exit(drift ? 1 : 0);
