#!/usr/bin/env node
// Скрипт Workflow не импортирует, а узел читает только свой файл, поэтому общий код треков и словарь стыка - копии;
// источник один, копия в треке и в файле узла - вывод генератора.

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
const AGENTS = join(REPO_ROOT, 'plugins', 'auto', 'dex-auto', 'agents');

const checkOnly = process.argv.includes('--check');
const MARK = {
  js: { OPEN: /^\/\/ >>> shared: ([a-z0-9-]+)\s*$/, CLOSE: /^\/\/ <<< shared: ([a-z0-9-]+)\s*$/, form: '`// >>> shared: <имя>` / `// <<< shared: <имя>`' },
  md: { OPEN: /^<!-- >>> shared: ([a-z0-9-]+) -->\s*$/, CLOSE: /^<!-- <<< shared: ([a-z0-9-]+) -->\s*$/, form: '`<!-- >>> shared: <имя> -->` / `<!-- <<< shared: <имя> -->`' },
};
// Строка, похожая на маркер, но не совпавшая со строгим, молча стала бы кодом трека, а блок - ручной копией.
const LOOSE = /^\s*(\/\/|<!--)\s*(>>>|<<<)/;
const kindOf = (file) => (file.endsWith('.md') ? 'md' : 'js');
// Все имена верхнего уровня источника вне блоков трека - копия, которую генератор не видит: так остаётся блок со снятыми маркерами.
// Одно совпавшее имя - не копия: трек вправе держать своё (review.js - свою схему REVIEW).
const DECL = /^(?:export\s+)?(?:const|let|var|class|(?:async\s+)?function\*?)\s+([A-Za-z_$][\w$]*)/;

const rel = (p) => relative(REPO_ROOT, p);
const errors = [];
const stale = [];
const used = new Set();
const sources = existsSync(SHARED) ? readdirSync(SHARED).filter((f) => /\.(js|md)$/.test(f)) : [];
const stem = (f) => f.replace(/\.(js|md)$/, '');
const declared = new Map();
const namesOf = new Map();
for (const f of sources) {
  const text = readFileSync(join(SHARED, f), 'utf8');
  if (text.includes('\r')) errors.push(`${rel(join(SHARED, f))}: CR в источнике - блок трека собрался бы со смешанными концами строк`);
  text.split('\n').forEach((line, i) => {
    if (LOOSE.test(line)) errors.push(`${rel(join(SHARED, f))}:${i + 1}: строка маркера в источнике - разметка трека сломалась бы при вставке`);
    const d = f.endsWith('.js') && line.match(DECL);
    if (d) { declared.set(d[1], f); namesOf.set(f, [...(namesOf.get(f) || []), d[1]]); }
  });
}

function rebuild(file, text) {
  const kind = kindOf(file);
  const { OPEN, CLOSE, form } = MARK[kind];
  if (text.includes('\r')) errors.push(`${rel(file)}: CR в треке - сверка блоков по строкам ненадёжна`);
  const lines = text.split('\n');
  const out = [];
  const outside = new Set();
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(OPEN);
    if (!open) {
      if (CLOSE.test(lines[i])) errors.push(`${rel(file)}:${i + 1}: закрытие блока без открытия`);
      else if (LOOSE.test(lines[i])) errors.push(`${rel(file)}:${i + 1}: маркер не по форме ${form} с нулевой колонки`);
      const d = lines[i].match(DECL);
      if (d) outside.add(d[1]);
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
    const js = join(SHARED, `${name}.js`);
    const md = join(SHARED, `${name}.md`);
    const source = kind === 'js' ? js : md;
    if (!existsSync(source)) {
      errors.push(`${rel(file)}:${i + 1}: источника ${rel(kind === 'js' ? js : md)} нет`);
      out.push(...lines.slice(i, end + 1));
    } else {
      used.add(name);
      const text = readFileSync(source, 'utf8').replace(/\n+$/, '');
      const body = text.split('\n');
      if (lines.slice(i + 1, end).join('\n') !== body.join('\n')) stale.push(`${rel(file)}: блок "${name}" расходится с ${rel(source)}`);
      out.push(lines[i], ...body, lines[end]);
    }
    i = end;
  }
  if (kind === 'js') for (const [f, names] of namesOf) {
    if (names.every((n) => outside.has(n))) errors.push(`${rel(file)}: имена ${rel(join(SHARED, f))} (${names.join(', ')}) объявлены вне блока - копия без маркеров, правка источника до неё не дойдёт`);
  }
  return out.join('\n');
}

const tracks = [
  ...readdirSync(TRACKS).filter((f) => f.endsWith('.js')).map((f) => join(TRACKS, f)),
  ...(existsSync(AGENTS) ? readdirSync(AGENTS).filter((f) => f.endsWith('.md')).map((f) => join(AGENTS, f)) : []),
];
const rebuilt = tracks.map((file) => {
  const text = readFileSync(file, 'utf8');
  return { file, text, next: rebuild(file, text) };
});

// Источник, который ни один трек не вставляет, - мёртвый дом: правка в нём ни на что не влияет.
for (const f of sources) {
  const name = stem(f);
  if (!used.has(name)) errors.push(`${rel(join(SHARED, f))}: ни один трек и узел не вставляет блок "${name}"`);
}

// Значение enum схемы без строки словаря стыка узел отдаёт, не зная его смысла.
function enumNamed(file, re, what, mdName) {
  const vals = listIn(file, re, what);
  const md = join(SHARED, `${mdName}.md`);
  if (!vals || !existsSync(md)) { if (vals) errors.push(`${rel(md)}: словаря для ${what} нет`); return; }
  const text = readFileSync(md, 'utf8');
  const lost = vals.filter((v) => !text.includes(`\`${v}\``));
  if (lost.length) errors.push(`${rel(md)}: значения ${what} не названы - ${lost.join(', ')}`);
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
const contract = join(SHARED, 'contract.js');
enumNamed(contract, /^const STATUS = \{[^}]*enum: \[([^\]]*)\]/m, 'STATUS', 'status');
enumNamed(contract, /^const VERDICT = \{[^}]*enum: \[([^\]]*)\]/m, 'VERDICT', 'review-verdict');
enumNamed(domain, /^const AXIS = \{[^}]*enum: \[([^\]]*)\]/m, 'AXIS', 'axes');
enumNamed(domain, /^const AXIS_OUTCOME = \[([^\]]*)\]/m, 'AXIS_OUTCOME', 'axes');
enumNamed(domain, /^const PRIOR_STATUS = \[([^\]]*)\]/m, 'PRIOR_STATUS', 'prior-status');
enumNamed(join(TRACKS, 'bugfix.js'), /'diagnosis-check': \{ type: 'string', enum: \[([^\]]*)\]/, 'diagnosis-check', 'diagnosis-acceptance');

if (errors.length) {
  for (const e of errors) console.error(`ERROR ${e}`);
  process.exit(1);
}

if (checkOnly) {
  if (stale.length) {
    for (const s of stale) console.error(`ERROR ${s}; пересобрать: npm run sync:tracks`);
    process.exit(1);
  }
  console.log(`sync-tracks: ${tracks.length} треков и узлов, блоков из ${used.size} источников - синхронно; словарь статусов находки совпадает с ledger и finish, enum STATUS, VERDICT, AXIS, AXIS_OUTCOME, PRIOR_STATUS и diagnosis-check названы в словаре стыка`);
  process.exit(0);
}

for (const { file, text, next } of rebuilt) if (next !== text) writeFileSync(file, next);
console.log(`sync-tracks: пересобрано ${stale.length} блоков`);
