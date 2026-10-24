#!/usr/bin/env node
// Словарь каталога: имена `к вытеснению` в текстах и дом каждого термина (адрес существует, термин в носителе стоит);
// норма и границы области - docs/VALIDATOR_RULES.md.

import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');

const COLORS = { reset: '\x1b[0m', red: '\x1b[31m', yellow: '\x1b[33m', gray: '\x1b[90m', bold: '\x1b[1m' };

// Уровень правила. Норма (CLAUDE.md, «Имя сущности корпуса берётся из словаря») называет имя `к вытеснению` дефектом,
// поэтому находка - ошибка и останавливает `npm run validate`: новое имя к вытеснению не проходит в PR молча.
// Колонка «Синонимы источника» из-под правила выведена (см. blankSourceSynonyms), так что дерево чисто.
const LEVEL = 'error';

// Дом термина: адрес в ячейке «Дом» существует и термин в носителе стоит. Присутствие - признак мягче существования
// (падеж, порядок слов), поэтому матчер допускает склонение и перестановку слов; живое расхождение имени в словаре и в носителе
// чинится правкой имени либо адреса, а равноправное имя, которым носитель пользуется, заводится синонимом `канон`.
const DICTIONARY = join(REPO_ROOT, 'docs', 'domain', 'domain-model.md');

// Закрытый перечень - блок «Имена `к вытеснению`» сгенерированного индекса, а не второй список в коде: индекс
// строится из словаря, и его синхронность с ним держит `sync-terminology.js --check`.
const INDEX_FILE = join(REPO_ROOT, '.claude', 'rules', 'terminology.md');
const INDEX_MARKER = '**Имена `к вытеснению`**';

// Область: тексты каталога - `.md` под `plugins/`, `docs/` и `.claude/rules/`, корневые `README.md` и `CLAUDE.md`.
// Вне её - записи, где старое имя стоит на своём месте: словарь и индекс (имя там предмет определения), ADR
// (снимок решения), записи замеров (имя, как оно называлось на момент замера; переписать значит подделать запись),
// research (слово «раунд» там - раунд эксперимента, не ревизия).
const ROOTS = ['plugins', 'docs', '.claude/rules'];
const ROOT_FILES = ['README.md', 'CLAUDE.md'];
const SKIP_DIRS = ['docs/adr', 'docs/research', 'plugins/auto/docs/notes'];
const SKIP_FILES = ['docs/domain/domain-model.md', '.claude/rules/terminology.md'];
const SOURCE_SYNONYMS_COLUMN = 'Синонимы источника';

// Обход не проходит по symlink и спецфайлам: цикл ссылок ронял бы прогон стектрейсом, а ссылка наружу судила бы
// чужой файл как свой. Такой узел - отказ с кодом 1, а не тихий пропуск.
function statPlain(full) {
  const stat = lstatSync(full);
  if (stat.isSymbolicLink() || !(stat.isFile() || stat.isDirectory())) {
    console.error(`Not a regular file or directory (symlinks and special files are not followed): ${relative(REPO_ROOT, full)}`);
    process.exit(1);
  }
  return stat;
}

// Путь и имя приходят из файлов под суд: управляющие символы переписали бы терминал, `##[` стал бы командой раннера Actions.
function show(value) {
  return String(value)
    .replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .replace(/##\[/g, '#\\u0023[')
    .replace(/::/g, ':\\u003a');
}

function fail(message) {
  console.error(show(message));
  process.exit(1);
}

function loadOustedNames() {
  if (!existsSync(INDEX_FILE)) fail(`${relative(REPO_ROOT, INDEX_FILE)} not found - run \`npm run sync:terminology\``);
  const line = readFileSync(INDEX_FILE, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(INDEX_MARKER));
  const colon = line ? line.lastIndexOf(': ') : -1;
  const names = colon < 0 ? [] : line.slice(colon + 2).replace(/\.\s*$/, '').split(', ').map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) fail(`${relative(REPO_ROOT, INDEX_FILE)}: no names under "${INDEX_MARKER}" - the index format changed, fix the reader instead of bypassing it`);
  return names;
}

// Имя матчится фразой целиком. Расширение до слова давало 10 ложных из 10 («круг» -> «возврат по кругу»), поэтому
// допуск один: падежное окончание. Кириллическое слово теряет последнюю гласную и берёт до трёх букв (`круг` -> `круга`,
// `рекомендация` -> `рекомендации`, `владелец` -> `владельца`); латинское берёт апостроф и до трёх букв (`skill'ы`).
// Границы: перед именем не буква и не дефис (`skill этапа` не срабатывает внутри `process-skill этапа`), после - не
// буква и не дефис-буква (`раунд-трип`). Пробел между словами - любой, включая перевод строки и `>` цитаты: замена,
// пересёкшая перевод строки, и была тем, что ручной проход пропустил («за два\nревизии»).
function wordPattern(word) {
  const tail = '\\p{L}{0,3}';
  if (/^[\p{Script=Cyrillic}]+$/u.test(word)) {
    const stem = word.replace(/[аяыиоеуюьй]$/u, '');
    return (stem.endsWith('ец') ? `${stem.slice(0, -2)}(?:ец|ьц)` : stem) + tail;
  }
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `['’]?${tail}`;
}

function buildMatcher(name) {
  const body = name.split(/\s+/).map(wordPattern).join('[\\s>]+');
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${body}(?![\\p{L}\\p{N}_]|-\\p{L})`, 'giu');
}

// Frontmatter затирается у любого `.md`, не только у скилла и агента: там живут активаторы, и синоним в них законен
// как ключ поиска (ось «Терминология» в `artifact-review`). Затирается пробелами, номера строк остаются прежними.
function blankFrontmatter(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  return m ? m[0].replace(/[^\n]/g, ' ') + text.slice(m[0].length) : text;
}

// Колонка «Синонимы источника» - имена, которые приёмник узнаёт в источнике; класс тот же, что у словаря и активаторов,
// и вытесняемое имя там законно. Колонка находится по шапке таблицы, и затирается ячейка в шапке и во всех строках
// этой таблицы; соседние колонки той же таблицы судятся как обычно. Номера строк остаются прежними.
function blankSourceSynonyms(text) {
  const cellSpans = (line) => {
    const spans = [];
    let start = null;
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== '|' || line[i - 1] === '\\') continue;
      if (start !== null) spans.push([start, i]);
      start = i + 1;
    }
    return spans;
  };
  const isSeparator = (line) => line && line.startsWith('|') && cellSpans(line).every(([a, b]) => /^\s*:?-+:?\s*$/.test(line.slice(a, b)));
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].startsWith('|') || !isSeparator(lines[i + 1])) continue;
    const column = cellSpans(lines[i]).findIndex(([a, b]) => lines[i].slice(a, b).includes(SOURCE_SYNONYMS_COLUMN));
    let end = i;
    while (end < lines.length && lines[end].startsWith('|')) end++;
    if (column >= 0) {
      for (let j = i; j < end; j++) {
        const span = cellSpans(lines[j])[column];
        if (span) lines[j] = lines[j].slice(0, span[0]) + lines[j].slice(span[0], span[1]).replace(/[^\r]/g, ' ') + lines[j].slice(span[1]);
      }
    }
    i = end - 1;
  }
  return lines.join('\n');
}

function lineLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

function findFiles() {
  const files = [];
  const rel = (full) => relative(REPO_ROOT, full).split(sep).join('/');
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const path = rel(full);
      if (statPlain(full).isDirectory()) {
        if (!SKIP_DIRS.includes(path)) walk(full);
      } else if (path.endsWith('.md') && !SKIP_FILES.includes(path)) {
        files.push(full);
      }
    }
  }
  for (const root of ROOTS) walk(join(REPO_ROOT, root));
  for (const file of ROOT_FILES) {
    const full = join(REPO_ROOT, file);
    if (existsSync(full) && statPlain(full).isFile()) files.push(full);
  }
  return files;
}

function validateFile(filepath, matchers) {
  const text = blankSourceSynonyms(blankFrontmatter(readFileSync(filepath, 'utf8')));
  const lineAt = lineLocator(text);
  const findings = [];
  for (const { name, re } of matchers) {
    for (const m of text.matchAll(re)) {
      findings.push({
        rule: 'ousted-name',
        line: lineAt(m.index),
        message: `name "${name}" is marked \`к вытеснению\` in the dictionary (found "${m[0].replace(/\s+/g, ' ')}") - use the main name of the row in docs/domain/domain-model.md that lists it among synonyms`,
      });
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}

// ---------------------------------------------------------------------------------------------------------------------
// Дом термина: словарь `docs/domain/domain-model.md`, колонка «Дом».
//
// Форма ячейки одна: первым в бэктиках стоит адрес - путь от корня репозитория либо `плагин:артефакт`; дальше свободный
// текст (раздел, пункт, `references/...` того же артефакта, дополнительные адреса). Прочие code-span в ячейке
// (идентификаторы, команды, имена полей) адресом не считаются и не судятся.
// ---------------------------------------------------------------------------------------------------------------------
const PATH_ADDRESS_RE = /^(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.@-]+\.[a-z]{1,4}$|^[A-Z][A-Za-z_]*\.md$/;
const ARTIFACT_ADDRESS_RE = /^(dex-[a-z0-9-]+):([a-z0-9-]+)$/;
const RELATIVE_REFERENCE_RE = /^references\/[A-Za-z0-9_./-]+\.md$/;

function cellsOf(line) {
  return line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

function isSeparatorRow(line) {
  return line.startsWith('|') && cellsOf(line).every((c) => /^:?-+:?$/.test(c));
}

// Строки таблиц словаря, у которых в шапке есть колонки «Термин» и «Дом»: другие таблицы (например, «Термины без дома»)
// домов не несут. Номер строки - для сообщения.
function readDictionaryRows() {
  if (!existsSync(DICTIONARY) || !statPlain(DICTIONARY).isFile()) return [];
  const lines = readFileSync(DICTIONARY, 'utf8').split('\n');
  const rows = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].startsWith('|') || !isSeparatorRow(lines[i + 1])) continue;
    const header = cellsOf(lines[i]);
    const col = { term: header.indexOf('Термин'), synonyms: header.indexOf('Синонимы'), home: header.indexOf('Дом') };
    let end = i + 2;
    while (end < lines.length && lines[end].startsWith('|')) end++;
    if (col.term === 0 && col.home > 0) {
      for (let j = i + 2; j < end; j++) {
        const cells = cellsOf(lines[j]);
        rows.push({ line: j + 1, term: cells[col.term] || '', synonyms: col.synonyms >= 0 ? cells[col.synonyms] || '' : '', home: cells[col.home] || '' });
      }
    }
    i = end - 1;
  }
  return rows;
}

// Плагин по имени из манифеста. Обход не идёт по symlink и спецфайлам (см. statPlain).
function buildPluginDirs() {
  const dirs = new Map();
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      if (statPlain(full).isDirectory()) {
        walk(full);
      } else if (entry === 'plugin.json' && dirname(full).endsWith(`${sep}.claude-plugin`)) {
        try {
          const name = JSON.parse(readFileSync(full, 'utf8')).name;
          if (name && !dirs.has(name)) dirs.set(name, dirname(dirname(full)));
        } catch {
          // нечитаемый манифест - плагин для адреса не существует; сам манифест судят другие валидаторы
        }
      }
    }
  }
  walk(join(REPO_ROOT, 'plugins'));
  return dirs;
}

function markdownFilesUnder(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statPlain(full).isDirectory()) files.push(...markdownFilesUnder(full));
    else if (entry.endsWith('.md')) files.push(full);
  }
  return files;
}

function frontmatterName(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const n = m && m[1].match(/^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m);
  return n ? n[1] : null;
}

// Носитель адреса: файлы, в которых ищется термин. Скилл - `SKILL.md` и его `references/`; агент и команда - свой файл.
// null - адрес не существует. `skillDir` нужен относительным ссылкам `references/...`.
function carrierOf(address, pluginDirs) {
  const art = address.match(ARTIFACT_ADDRESS_RE);
  if (art) {
    const root = pluginDirs.get(art[1]);
    if (!root) return null;
    const name = art[2];
    const skillFile = join(root, 'skills', name, 'SKILL.md');
    if (existsSync(skillFile) && statPlain(skillFile).isFile()) {
      return { files: [skillFile, ...markdownFilesUnder(join(root, 'skills', name, 'references'))], skillDir: join(root, 'skills', name) };
    }
    const command = join(root, 'commands', `${name}.md`);
    if (existsSync(command) && statPlain(command).isFile()) return { files: [command], skillDir: null };
    const agentsDir = join(root, 'agents');
    if (existsSync(agentsDir)) {
      for (const f of readdirSync(agentsDir).sort()) {
        const full = join(agentsDir, f);
        if (!f.endsWith('.md') || !statPlain(full).isFile()) continue;
        if (f === `${name}.md` || frontmatterName(readFileSync(full, 'utf8')) === name) return { files: [full], skillDir: null };
      }
    }
    return null;
  }
  const full = resolve(REPO_ROOT, address);
  if (full !== REPO_ROOT && !full.startsWith(REPO_ROOT + sep)) return null;
  if (!existsSync(full) || !statPlain(full).isFile()) return null;
  return { files: [full], skillDir: null };
}

// Падежный допуск шире, чем у имён `к вытеснению`: словарное имя стоит в именительном, носитель склоняет его и переставляет
// слова. Кириллическое слово длиннее пяти букв теряет два последних (`различающая` -> `различающей`).
function stemPattern(word) {
  const w = word.toLowerCase();
  if (/^[\p{Script=Cyrillic}]+$/u.test(w)) {
    const stem = w.length > 5 ? w.slice(0, -2) : w.replace(/[аяыиоеуюьй]$/u, '');
    return `${stem}\\p{L}{0,4}`;
  }
  return `${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['’]?\\p{L}{0,3}`;
}

function termMatcher(key) {
  const words = key.split(/\s+/).filter(Boolean);
  const edge = (pattern) => new RegExp(`(?<![\\p{L}\\p{N}_-])${pattern}(?![\\p{L}\\p{N}_])`, 'iu');
  return { phrase: edge(words.map(stemPattern).join('[\\s>]+')), each: words.map((w) => edge(stemPattern(w))) };
}

// Имена, под которыми термин ищется в носителе: само имя (с разбором `A / B` и скобки) и равноправные синонимы `канон`.
// Синоним `к вытеснению` присутствием не засчитывается - его в тексте как раз быть не должно.
function termKeys(term, synonyms) {
  const keys = [];
  for (const m of term.matchAll(/\(([^)]*)\)/g)) keys.push(m[1]);
  for (const part of term.replace(/\([^)]*\)/g, ' ').split(/\s\/\s/)) keys.push(part);
  for (const seg of synonyms.split(';')) {
    const at = seg.indexOf('`канон`');
    if (at >= 0) keys.push(seg.slice(0, at));
  }
  return [...new Set(keys.map((k) => k.replace(/`/g, '').trim()).filter(Boolean))];
}

// Термин присутствует, если имя стоит фразой либо все его слова стоят в одном абзаце (строка таблицы - свой абзац):
// носитель переставляет слова («Находки - реестр»), а порядок слов смысл имени не меняет.
function termInText(text, key) {
  const { phrase, each } = termMatcher(key);
  if (phrase.test(text)) return true;
  if (each.length < 2) return false;
  const blocks = text.split(/\n\s*\n/).flatMap((b) => (b.split('\n').some((l) => l.startsWith('|')) ? b.split('\n') : [b]));
  return blocks.some((b) => each.every((re) => re.test(b)));
}

function validateDictionaryHomes() {
  const rows = readDictionaryRows();
  if (rows.length === 0) return [];
  const pluginDirs = buildPluginDirs();
  const textCache = new Map();
  const read = (f) => {
    if (!textCache.has(f)) textCache.set(f, readFileSync(f, 'utf8'));
    return textCache.get(f);
  };
  const isAddress = (t) => PATH_ADDRESS_RE.test(t) || ARTIFACT_ADDRESS_RE.test(t);
  const findings = [];
  for (const row of rows) {
    const term = row.term.replace(/`/g, '');
    const spans = [...row.home.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const unresolved = (message) => findings.push({ rule: 'home-unresolved', level: LEVEL, line: row.line, message: `term "${term}": ${message}` });
    if (spans.length === 0 || !isAddress(spans[0])) {
      unresolved(`the "Дом" cell must start with an address in backticks - a repo path or \`plugin:artifact\` (found ${spans.length === 0 ? 'no code span' : `"${spans[0]}"`})`);
      continue;
    }
    const carriers = [];
    let skillDir = null;
    let broken = false;
    for (const t of spans) {
      if (RELATIVE_REFERENCE_RE.test(t)) {
        const file = skillDir ? resolve(skillDir, t) : null;
        if (!file || !file.startsWith(skillDir + sep) || !existsSync(file) || !statPlain(file).isFile()) {
          unresolved(`reference \`${t}\` does not resolve ${skillDir ? 'inside the skill named before it' : '- no skill address stands before it'}`);
          broken = true;
        } else {
          carriers.push(file);
        }
        continue;
      }
      if (!isAddress(t)) continue;
      const carrier = carrierOf(t, pluginDirs);
      if (!carrier) {
        unresolved(`home address \`${t}\` does not exist`);
        broken = true;
        continue;
      }
      carriers.push(...carrier.files);
      skillDir = carrier.skillDir;
    }
    if (broken || carriers.length === 0) continue;
    const text = [...new Set(carriers)].map(read).join('\n\n');
    const keys = termKeys(row.term, row.synonyms);
    if (!keys.some((k) => termInText(text, k))) {
      findings.push({
        rule: 'home-term-absent',
        level: LEVEL,
        line: row.line,
        message: `term "${term}" is not found in its home (${spans.filter(isAddress).map((a) => `\`${a}\``).join(', ')}; looked for: ${keys.map((k) => `"${k}"`).join(', ')}) - fix the home address or the name in the dictionary`,
      });
    }
  }
  return findings.sort((x, y) => x.line - y.line);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && args[0] !== 'all')) fail('Usage: node tools/validate-terminology.js [all]');
  if (process.env.MARKETPLACE_ROOT === '') fail('MARKETPLACE_ROOT is set but empty - unset it or point it at a marketplace tree');

  const names = loadOustedNames();
  const matchers = names.map((name) => ({ name, re: buildMatcher(name) }));
  const files = findFiles();

  const reports = files.map((filepath) => ({ filepath, findings: validateFile(filepath, matchers).map((f) => ({ ...f, level: LEVEL })) }));
  const homeFindings = validateDictionaryHomes();
  if (homeFindings.length > 0) reports.push({ filepath: DICTIONARY, findings: homeFindings });

  let errors = 0;
  let warnings = 0;
  for (const { filepath, findings } of reports) {
    if (findings.length === 0) continue;
    console.log(`\n${COLORS.bold}${show(relative(REPO_ROOT, filepath))}${COLORS.reset}`);
    for (const f of findings) {
      const label = f.level === 'warning' ? `${COLORS.yellow}WARN ` : `${COLORS.red}ERROR`;
      console.log(`  ${label}${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} line ${f.line}: ${show(f.message)}`);
      if (f.level === 'warning') warnings += 1;
      else errors += 1;
    }
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${files.length} file(s) checked against ${names.length} name(s), ` +
      `${COLORS.red}${errors} error(s)${COLORS.reset}, ${COLORS.yellow}${warnings} warning(s)${COLORS.reset}`
  );
  process.exit(errors > 0 ? 1 : 0);
}

main();
