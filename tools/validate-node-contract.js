#!/usr/bin/env node
// Имена полей стыка в телах агентов и схемах треков против словаря node-contract; норма и Usage - docs/VALIDATOR_RULES.md.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
const PLUGINS_DIR = join(REPO_ROOT, 'plugins');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const DICTIONARY_HEADING = '## Словарь полей';
// Дом имени - один скилл по одному адресу: первый попавшийся при обходе `node-contract/SKILL.md`
// давал эталон любой копии, а копия без словаря выключала суд целиком.
const DICTIONARY_FILE = join(PLUGINS_DIR, 'skills', 'dex-skill-node-contract', 'skills', 'node-contract', 'SKILL.md');

// Имя и путь приходят из файлов под суд: управляющий символ в выводе переписал бы терминал, а строка,
// начатая с `::`, стала бы workflow-командой в логе CI. Печатается экранированная форма.
function show(value) {
  return String(value).replace(/[\x00-\x1f\x7f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

// Номер строки по смещению: начала строк считаются один раз на файл.
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

// --- Dictionary ---------------------------------------------------------

// Возвращает { names } либо { missing: причина }. Нечитаемый словарь - находка, а не пустой прогон:
// validate-agent.js неизвестный плагин объявляет вне области проверки, переименованный раздел не видит
// никто, и суд имён выключался бы зелёным. Нет файла, нет раздела, нет строк - один исход: имён ноль.
// Заголовок ищется построчно (`^...$` в режиме `m`, где `\r` - тоже конец строки): файл, сохранённый с CRLF,
// или заголовок с хвостовым пробелом - тот же словарь, а не пропавший.
function loadDictionary() {
  const exists = existsSync(DICTIONARY_FILE);
  const text = exists ? readFileSync(DICTIONARY_FILE, 'utf8') : '';
  const heading = new RegExp(`^${DICTIONARY_HEADING}[ \\t]*$`, 'm').exec(text);
  let section = '';
  if (heading) {
    const rest = text.slice(heading.index + heading[0].length);
    const end = rest.indexOf('\n## ');
    section = end === -1 ? rest : rest.slice(0, end);
  }

  const names = new Set();
  for (const line of section.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) names.add(m[1]);
  }
  if (names.size === 0) {
    return { missing: exists ? `no backticked field name in a table under "${DICTIONARY_HEADING}"` : 'file not found' };
  }
  return { names };
}

// Разделитель, регистр и граница слова в camelCase - то, чем имя расходится молча; прочая разница делает его
// другим полем, а не другой записью.
function normalize(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[-_.\s]+/g, '-');
}

function buildSpellingIndex(names) {
  const index = new Map();
  for (const name of names) index.set(normalize(name), name);
  return index;
}

// --- Collecting candidate names ------------------------------------------

// В прозе агента имя поля стоит в backticks.
function collectFromAgent(text, lineAt) {
  const found = [];
  for (const m of text.matchAll(/`([A-Za-z][A-Za-z0-9_ -]*)`/g)) {
    found.push({ name: m[1], where: 'тело агента', line: lineAt(m.index) });
  }
  return found;
}

// Трек читается текстом, а не исполняется: рантайма Workflow вне прогона нет, да и предмет здесь -
// написание. Построчный регэксп видел только ключ в начале строки и одинарные кавычки, поэтому трек
// разбирается сканером: строки обеих кавычек, комментарии, регэксп-литералы и шаблонные строки (промпты
// узлам, в том числе вложенные через `${...}`) - отдельно от кода, ключ объекта - имя или строка между
// `{`/`,` и `:`. Конструкция, не закрытая до конца строки или файла, - не тихий обрыв: всё после неё не
// судится, и сканер отдаёт это находкой.

// `/` открывает регэксп, а не деление, после знака или слова, за которыми выражение только начинается.
const REGEX_AFTER_PUNCT = new Set('(,=:[!&|?{};+-*%<>~^'.split(''));
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);

function skipRegex(text, i, scan) {
  const start = i;
  let inClass = false;
  i++;
  while (i < text.length && text[i] !== '\n') {
    const c = text[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) {
      i++;
      while (i < text.length && /[a-z]/.test(text[i])) i++;
      return i;
    }
    i++;
  }
  scan.unclosed ??= { kind: 'regex literal', start };
  return text.length;
}

function skipString(text, i, scan) {
  const quote = text[i];
  const start = i;
  let value = '';
  i++;
  while (i < text.length && text[i] !== quote && text[i] !== '\n') {
    if (text[i] === '\\') { value += text[i + 1] ?? ''; i += 2; continue; }
    value += text[i++];
  }
  if (text[i] !== quote) {
    scan.unclosed ??= { kind: 'string literal', start };
    return { end: text.length, value, start };
  }
  return { end: i + 1, value, start };
}

function skipTemplate(text, i, scan) {
  const start = i - 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i + 1;
    if (c === '$' && text[i + 1] === '{') { i = skipInterpolation(text, i + 2, scan); continue; }
    i++;
  }
  scan.unclosed ??= { kind: 'template literal', start };
  return text.length;
}

function skipInterpolation(text, i, scan) {
  const start = i - 2;
  let depth = 1;
  let prev = '{';
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (c === "'" || c === '"') { i = skipString(text, i, scan).end; prev = c; continue; }
    if (c === '`') { i = skipTemplate(text, i + 1, scan); prev = c; continue; }
    if (c === '/' && REGEX_AFTER_PUNCT.has(prev)) { i = skipRegex(text, i, scan); prev = '/'; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  if (depth > 0) scan.unclosed ??= { kind: 'template interpolation ${...}', start };
  return i;
}

function tokenize(text, scan) {
  const tokens = [];
  let i = 0;
  const regexAllowed = () => {
    const last = tokens[tokens.length - 1];
    if (!last) return true;
    if (last.type === 'punct') return REGEX_AFTER_PUNCT.has(last.value);
    return last.type === 'ident' && REGEX_AFTER_WORD.has(last.value);
  };
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      const eol = text.indexOf('\n', i);
      i = eol === -1 ? text.length : eol;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      if (close === -1) scan.unclosed ??= { kind: 'block comment', start: i };
      i = close === -1 ? text.length : close + 2;
      continue;
    }
    if (c === '/' && regexAllowed()) { i = skipRegex(text, i, scan); continue; }
    if (c === "'" || c === '"') {
      const s = skipString(text, i, scan);
      tokens.push({ type: 'str', value: s.value, start: s.start });
      i = s.end;
      continue;
    }
    if (c === '`') { i = skipTemplate(text, i + 1, scan); continue; }
    if (/[A-Za-z_$]/.test(c)) {
      const start = i;
      while (i < text.length && /[\w$]/.test(text[i])) i++;
      tokens.push({ type: 'ident', value: text.slice(start, i), start });
      continue;
    }
    if (!/\s/.test(c)) tokens.push({ type: 'punct', value: c, start: i });
    i++;
  }
  return tokens;
}

const isName = (t) => t && (t.type === 'ident' || t.type === 'str');
const isPunct = (t, v) => t && t.type === 'punct' && t.value === v;

// Ключ объекта: имя или строка, за которой `:`, а перед которой `{` или `,` (так тернарный `? a : b`
// и `case x:` ключом не считаются).
function isKeyAt(tokens, k) {
  return isName(tokens[k]) && isPunct(tokens[k + 1], ':') && (isPunct(tokens[k - 1], '{') || isPunct(tokens[k - 1], ','));
}

// Ключи первого уровня объекта, открытого `{` на позиции open.
function objectKeys(tokens, open) {
  const keys = [];
  let depth = 0;
  for (let k = open; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type === 'punct' && '{[('.includes(t.value)) depth++;
    else if (t.type === 'punct' && '}])'.includes(t.value)) { depth--; if (depth === 0) break; }
    else if (depth === 1 && isKeyAt(tokens, k)) keys.push(t);
  }
  return keys;
}

// Строки массива, открытого `[` на позиции open; первый нестроковый элемент (константа, spread) - отдельно:
// порядок и написание такого перечня не судятся.
function arrayStrings(tokens, open) {
  const items = [];
  let nonLiteral = null;
  for (let k = open + 1; k < tokens.length && !isPunct(tokens[k], ']'); k++) {
    if (tokens[k].type === 'str') items.push(tokens[k]);
    else if (isPunct(tokens[k], '.')) nonLiteral ??= { value: '...spread', start: tokens[k].start };
    else if (!isPunct(tokens[k], ',')) nonLiteral ??= tokens[k];
  }
  return { items, nonLiteral };
}

const LITERAL_WORDS = new Set(['true', 'false', 'null', 'undefined']);

function parseTrack(text) {
  const scan = { unclosed: null };
  const tokens = tokenize(text, scan);
  const keys = [];
  const requiredLists = [];
  const propertiesLists = [];
  const unjudged = [];
  for (let k = 0; k < tokens.length; k++) {
    if (!isKeyAt(tokens, k)) continue;
    keys.push(tokens[k]);
    const name = tokens[k].value;
    if (name !== 'required' && name !== 'properties') continue;
    const value = tokens[k + 2];
    const literalOpen = name === 'required' ? '[' : '{';
    if (isPunct(value, literalOpen)) {
      if (name === 'required') {
        const list = arrayStrings(tokens, k + 2);
        requiredLists.push(list.items);
        if (list.nonLiteral) unjudged.push({ start: list.nonLiteral.start, what: `required: [...] holds a non-literal element "${list.nonLiteral.value}"` });
      } else {
        propertiesLists.push(objectKeys(tokens, k + 2));
      }
    } else if (value && value.type === 'ident' && !LITERAL_WORDS.has(value.value)) {
      unjudged.push({ start: value.start, what: `${name}: ${value.value} is not a literal ${name === 'required' ? 'list' : 'object'}` });
    }
  }
  if (scan.unclosed) unjudged.push({ start: scan.unclosed.start, what: `${scan.unclosed.kind} is not closed, the rest of the file is not scanned` });
  return { keys, requiredLists, propertiesLists, unjudged };
}

function collectFromTrack(parsed, lineAt) {
  const found = parsed.keys.map((t) => ({ name: t.value, where: 'ключ схемы', line: lineAt(t.start) }));
  for (const list of parsed.requiredLists) {
    for (const t of list) found.push({ name: t.value, where: 'перечень required', line: lineAt(t.start) });
  }
  return found;
}

// --- Rules ---------------------------------------------------------------

// Каждое вхождение - своя находка со строкой, в том числе повтор в той же строке: схлопнутые повторы
// всплывали бы по одному после каждой починки.
function validateSpelling(candidates, dict, index, findings) {
  for (const { name, where, line } of candidates) {
    const canonical = index.get(normalize(name));
    if (!canonical || dict.names.has(name)) continue;
    findings.push({
      rule: 'contract-field-spelling',
      message: `line ${line}: "${show(name)}" (${where}) is the node-contract field \`${canonical}\` spelled differently - the receiver takes a field by name, and a renamed one reads as absent; write \`${canonical}\` verbatim`,
    });
  }
}

// A.1 объявляет `status` первым полем выхода. Судятся оба места, где схема задаёт порядок: ключи `properties`
// и перечень `required`. Порядок `required` на валидацию не влияет (JSON Schema, `required` - множество имён),
// порядок `properties` - порядок объявления; правило держит конвенцию объявления, а не маршрут вызывающего:
// трек берёт `status` по имени. Судится только объект, где `status` уже есть: у вложенного объекта (находка,
// звено) своего исхода нет.
function validateStatusFirst(parsed, lineAt, findings) {
  const judge = (list, where) => {
    const names = list.map((t) => t.value);
    if (!names.includes('status') || names[0] === 'status') return;
    findings.push({
      rule: 'contract-status-not-first',
      message: `line ${lineAt(list[0].start)}: ${where} [${names.map((n) => `'${show(n)}'`).join(', ')}] declares 'status' at position ${names.indexOf('status') + 1} - node-contract A.1 declares it the first field of a node output`,
    });
  };
  for (const list of parsed.propertiesLists) judge(list, 'properties');
  for (const list of parsed.requiredLists) judge(list, 'required:');
}

// Схема, которую сканер не разобрал, не судится ни на написание, ни на порядок - и это находка, а не молчание:
// валидатор - единственное принуждение к одному написанию имён в треке.
function validateJudgeable(parsed, lineAt, findings) {
  for (const u of parsed.unjudged) {
    findings.push({
      rule: 'contract-schema-unjudged',
      message: `line ${lineAt(u.start)}: ${show(u.what)} - field names there are not judged; write the schema as a literal object with a literal required list`,
    });
  }
}

// --- Files ---------------------------------------------------------------

// Носитель - тело агента `agents/*.md` или трек `tracks/*.js`; разделитель приводится к `/`: `join` на
// Windows отдаёт `\`, сравнение не совпало бы ни разу, и прогон нашёл бы ноль файлов - тот же класс, что
// закрыт в validate-agent.js.
function carrierKind(full) {
  const path = full.split(sep).join('/');
  if (/\/agents\/[^/]+\.md$/.test(path)) return 'agent';
  if (/\/tracks\/[^/]+\.js$/.test(path)) return 'track';
  return null;
}

function findFiles() {
  const agents = [];
  const tracks = [];
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const kind = carrierKind(full);
      if (kind === 'agent') agents.push(full);
      else if (kind === 'track') tracks.push(full);
    }
  }
  walk(PLUGINS_DIR);
  return [...agents.sort(), ...tracks.sort()];
}

function validateFile(filepath, dict, index) {
  const findings = [];
  // Файл только что найден обходом: нечитаемость здесь - отказ среды, и падение прогона громче тихой находки.
  const text = readFileSync(filepath, 'utf8');
  const lineAt = lineLocator(text);

  if (carrierKind(filepath) === 'track') {
    const parsed = parseTrack(text);
    validateSpelling(collectFromTrack(parsed, lineAt), dict, index, findings);
    validateStatusFirst(parsed, lineAt, findings);
    validateJudgeable(parsed, lineAt, findings);
  } else {
    validateSpelling(collectFromAgent(text, lineAt), dict, index, findings);
  }

  return { filepath, findings };
}

// --- Reporting ----------------------------------------------------------

function report(results, checkedLabel) {
  let totalErrors = 0;
  let filesWithIssues = 0;

  for (const result of results) {
    if (result.findings.length === 0) continue;
    totalErrors += result.findings.length;
    filesWithIssues += 1;
    console.log(`\n${COLORS.bold}${show(relative(REPO_ROOT, result.filepath))}${COLORS.reset}`);
    for (const f of result.findings) {
      console.log(`  ${COLORS.red}ERROR${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`);
    }
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${checkedLabel ?? `${results.length} file(s) checked`}, ` +
      `${COLORS.red}${totalErrors} error(s)${COLORS.reset}` +
      (filesWithIssues > 0 && !checkedLabel ? `, ${filesWithIssues} file(s) with issues` : '')
  );

  return totalErrors > 0 ? 1 : 0;
}

// --- Main ---------------------------------------------------------------

function fail(message) {
  console.error(show(message));
  process.exit(1);
}

function main() {
  const target = process.argv.slice(2).filter((a) => !a.startsWith('--'))[0] || 'all';

  const dict = loadDictionary();
  if (dict.missing) {
    process.exit(report([{
      filepath: DICTIONARY_FILE,
      findings: [{
        rule: 'contract-dictionary-missing',
        message: `node-contract field dictionary is unreadable (${dict.missing}) - no field name in agents or tracks can be judged; restore the "${DICTIONARY_HEADING}" table in ${show(relative(REPO_ROOT, DICTIONARY_FILE))}`,
      }],
    }], 'dictionary unreadable, 0 carrier file(s) checked'));
  }
  const index = buildSpellingIndex(dict.names);

  let files;
  if (target === 'all') {
    files = findFiles();
    // Ноль носителей при живом словаре - сломанный обход или чужой корень, а не чистый каталог.
    if (files.length === 0) fail(`No agent or track files found under ${relative(REPO_ROOT, PLUGINS_DIR)}`);
  } else {
    const abs = resolve(target);
    if (!existsSync(abs)) fail(`File not found: ${target}`);
    if (!statSync(abs).isFile()) fail(`Not a file: ${target}`);
    if (!carrierKind(abs)) fail(`Not a node-contract carrier (expected plugins/**/agents/*.md or plugins/**/tracks/*.js): ${target}`);
    files = [abs];
  }

  process.exit(report(files.map((f) => validateFile(f, dict, index))));
}

main();
