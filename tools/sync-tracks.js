#!/usr/bin/env node
// Скрипт Workflow не импортирует, поэтому общий код треков - копии; источник один, копия в треке - вывод генератора.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
// Вне каталога плагина: рантайм источники не читает, в поставку они не входят.
const SHARED = join(REPO_ROOT, 'plugins', 'auto', 'tracks-shared');
const TRACKS = join(REPO_ROOT, 'plugins', 'auto', 'dex-auto', 'tracks');

const checkOnly = process.argv.includes('--check');
const OPEN = /^\/\/ >>> shared: ([a-z0-9-]+)\b/;
const CLOSE = /^\/\/ <<< shared: ([a-z0-9-]+)\s*$/;

const rel = (p) => relative(REPO_ROOT, p);
const errors = [];
const stale = [];
const used = new Set();

function rebuild(file, text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(OPEN);
    if (!open) {
      if (CLOSE.test(lines[i])) errors.push(`${rel(file)}:${i + 1}: закрытие блока без открытия`);
      out.push(lines[i]);
      continue;
    }
    const name = open[1];
    let end = i + 1;
    while (end < lines.length && !OPEN.test(lines[end]) && !CLOSE.test(lines[end])) end++;
    const close = lines[end] && lines[end].match(CLOSE);
    if (!close || close[1] !== name) {
      errors.push(`${rel(file)}:${i + 1}: блок "${name}" не закрыт своим маркером до следующего маркера или конца файла`);
      out.push(...lines.slice(i, end));
      i = end - 1;
      continue;
    }
    const source = join(SHARED, `${name}.js`);
    if (!existsSync(source)) {
      errors.push(`${rel(file)}:${i + 1}: источника ${rel(source)} нет`);
      out.push(...lines.slice(i, end + 1));
    } else {
      used.add(name);
      const body = readFileSync(source, 'utf8').replace(/\n+$/, '').split('\n');
      if (lines.slice(i + 1, end).join('\n') !== body.join('\n')) stale.push(`${rel(file)}: блок "${name}" расходится с ${rel(source)}`);
      out.push(lines[i], ...body, lines[end]);
    }
    i = end;
  }
  return out.join('\n');
}

const tracks = readdirSync(TRACKS).filter((f) => f.endsWith('.js')).map((f) => join(TRACKS, f));
const rebuilt = tracks.map((file) => {
  const text = readFileSync(file, 'utf8');
  return { file, text, next: rebuild(file, text) };
});

// Источник, который ни один трек не вставляет, - мёртвый дом: правка в нём ни на что не влияет.
for (const f of existsSync(SHARED) ? readdirSync(SHARED).filter((f) => f.endsWith('.js')) : []) {
  const name = f.replace(/\.js$/, '');
  if (!used.has(name)) errors.push(`${rel(join(SHARED, f))}: ни один трек не вставляет блок "${name}"`);
}

// Статус, неизвестный finish, молча не закрывает находку: словарь держат три носителя.
const HOOKS = join(REPO_ROOT, 'plugins', 'auto', 'dex-auto', 'hooks', 'scripts');
const quoted = (text) => [...text.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]);
function listIn(file, re, what) {
  const m = existsSync(file) && readFileSync(file, 'utf8').match(re);
  if (!m) errors.push(`${rel(file)}: ${what} не найден - сверка словаря статусов невозможна`);
  return m ? quoted(m[1]) : null;
}
const domain = join(SHARED, 'domain.js');
const jsOpen = listIn(domain, /^const OPEN_FINDING = \[([^\]]*)\]/m, 'OPEN_FINDING');
const jsRest = listIn(domain, /^const FINDING_STATUS = \[\.\.\.OPEN_FINDING,([^\]]*)\]/m, 'FINDING_STATUS');
const pyOpen = listIn(join(HOOKS, 'dexauto.py'), /^OPEN_FINDING = \(([^)]*)\)/m, 'OPEN_FINDING');
const pyRest = listIn(join(HOOKS, 'finish.py'), /^STATUSES = dx\.OPEN_FINDING \+ \(([^)]*)\)/m, 'STATUSES');
const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
if (jsOpen && pyOpen && !same(jsOpen, pyOpen)) errors.push(`OPEN_FINDING: domain.js [${jsOpen}] != dexauto.py [${pyOpen}]`);
if (jsRest && pyRest && !same(jsRest, pyRest)) errors.push(`статусы реестра: FINDING_STATUS domain.js [${jsRest}] != STATUSES finish.py [${pyRest}]`);

if (errors.length) {
  for (const e of errors) console.error(`ERROR ${e}`);
  process.exit(1);
}

if (checkOnly) {
  if (stale.length) {
    for (const s of stale) console.error(`ERROR ${s}; пересобрать: npm run sync:tracks`);
    process.exit(1);
  }
  console.log(`sync-tracks: ${tracks.length} треков, блоков из ${used.size} источников - синхронно; словарь статусов находки совпадает с ledger и finish`);
  process.exit(0);
}

for (const { file, text, next } of rebuilt) if (next !== text) writeFileSync(file, next);
console.log(`sync-tracks: пересобрано ${stale.length} блоков`);
