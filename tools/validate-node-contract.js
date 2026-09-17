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

// Имя и путь приходят из файлов под суд: управляющий символ в выводе переписал бы терминал, строка с `::` в
// начале или `##[` в любом месте стала бы workflow-командой в логе CI (раннер Actions ищет `##[` по всей
// строке), а bidi-символ переставил бы видимый текст. Печатается экранированная форма.
function show(value) {
  return String(value)
    .replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .replace(/##\[/g, '#\\u0023[')
    .replace(/::/g, ':\\u003a');
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
// Разбор построчный: `\r` в конце строки (файл с CRLF) и хвостовой пробел у заголовка - тот же словарь, а
// конец раздела - следующий `## ` вне fenced-блока: заголовок-пример внутри ``` обрезал бы эталон молча.
function loadDictionary() {
  const exists = existsSync(DICTIONARY_FILE);
  const lines = (exists ? readFileSync(DICTIONARY_FILE, 'utf8') : '').split('\n').map((l) => l.replace(/\r$/, ''));
  const names = new Set();
  let inSection = false;
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (new RegExp(`^${DICTIONARY_HEADING}[ \\t]*$`).test(line)) { inSection = true; continue; }
    if (inSection && line.startsWith('## ')) break;
    if (!inSection) continue;
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) names.add(m[1]);
  }
  if (names.size === 0) {
    return { missing: exists ? `no backticked field name in a table under "${DICTIONARY_HEADING}"` : 'file not found' };
  }
  return { names };
}

// Разделитель (включая `/`), регистр и граница слова в camelCase - то, чем имя расходится молча; прочая
// разница делает его другим полем, а не другой записью.
function normalize(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[-_.\/\s]+/g, '-');
}

function buildSpellingIndex(names) {
  const index = new Map();
  for (const name of names) index.set(normalize(name), name);
  return index;
}

// --- Collecting candidate names ------------------------------------------

// В прозе агента имя поля стоит в code span. Судится и весь span, и каждый его фрагмент из букв, цифр,
// разделителей: `run_status = skipped`, `fix.red_run` несут имя внутри выражения. Однословное имя,
// отличное от словарного только регистром (`Type`, `Severity`, `APPROVE`), в прозе не судится: это поле
// чужого формата (шапка ADR, событие хостинга, колонка таблицы), а не другое написание поля стыка.
function collectFromAgent(text, lineAt) {
  const found = [];
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    const span = m[1];
    const parts = new Set([span.trim()]);
    for (const run of span.matchAll(/[A-Za-z][A-Za-z0-9_ \/-]*[A-Za-z0-9]|[A-Za-z]/g)) parts.add(run[0].trim());
    for (const word of span.matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)) parts.add(word[0]);
    for (const name of parts) {
      if (!/^[A-Za-z][A-Za-z0-9_ \/.-]*$/.test(name)) continue;
      if (!/[-_.\/\s]|[a-z0-9][A-Z]/.test(name)) {
        // Однословное: судится только camelCase-граница, смена регистра целиком - нет.
        continue;
      }
      found.push({ name, where: 'тело агента', line: lineAt(m.index) });
    }
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
// После `)` условия операторов выражение начинается заново: `if (a) /x/.test(s)`.
const CONDITION_WORDS = new Set(['if', 'while', 'for', 'with']);
// Вложенность шаблонов и `${...}` глубже этого - находка, а не переполнение стека.
const MAX_TEMPLATE_DEPTH = 500;

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
  scan.unclosed ??= { what: 'regex literal is not closed', start };
  return text.length;
}

// `\uXXXX`, `\u{...}` и `\xXX` в строке декодируются: `'run_status'` - то же имя, что `'run_status'`.
function skipString(text, i, scan) {
  const quote = text[i];
  const start = i;
  let value = '';
  i++;
  while (i < text.length && text[i] !== quote && text[i] !== '\n') {
    if (text[i] === '\\') {
      const esc = /^\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2}))/.exec(text.slice(i, i + 12));
      if (esc) { value += String.fromCodePoint(parseInt(esc[1] ?? esc[2] ?? esc[3], 16)); i += esc[0].length; continue; }
      value += text[i + 1] ?? '';
      i += 2;
      continue;
    }
    value += text[i++];
  }
  if (text[i] !== quote) {
    scan.unclosed ??= { what: 'string literal is not closed', start };
    return { end: text.length, value, start };
  }
  return { end: i + 1, value, start };
}

function skipTemplate(text, i, scan, depth = 1) {
  const start = i - 1;
  if (depth > MAX_TEMPLATE_DEPTH) {
    scan.unclosed ??= { what: `template literal nesting deeper than ${MAX_TEMPLATE_DEPTH} levels is not scanned`, start };
    return text.length;
  }
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i + 1;
    if (c === '$' && text[i + 1] === '{') { i = skipInterpolation(text, i + 2, scan, depth); continue; }
    i++;
  }
  scan.unclosed ??= { what: 'template literal is not closed', start };
  return text.length;
}

function skipInterpolation(text, i, scan, depth) {
  const start = i - 2;
  let braces = 1;
  let prev = '{';
  while (i < text.length && braces > 0) {
    const c = text[i];
    if (c === "'" || c === '"') { i = skipString(text, i, scan).end; prev = c; continue; }
    if (c === '`') { i = skipTemplate(text, i + 1, scan, depth + 1); prev = c; continue; }
    if (c === '/' && REGEX_AFTER_PUNCT.has(prev)) { i = skipRegex(text, i, scan); prev = '/'; continue; }
    if (c === '{') braces++;
    else if (c === '}') braces--;
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  if (braces > 0) scan.unclosed ??= { what: 'template interpolation ${...} is not closed', start };
  return i;
}

const PAIRS = { ')': '(', ']': '[', '}': '{' };

function tokenize(text, scan) {
  const tokens = [];
  const parens = [];
  let i = 0;
  const regexAllowed = () => {
    const last = tokens[tokens.length - 1];
    if (!last) return true;
    if (last.type === 'punct') {
      if (last.value === ')') return last.afterCondition === true;
      // Постфиксный `++`/`--` закрывает операнд: дальше деление, а не регэксп.
      const before = tokens[tokens.length - 2];
      if ((last.value === '+' || last.value === '-') && before && before.type === 'punct' && before.value === last.value && before.start === last.start - 1) {
        const operand = tokens[tokens.length - 3];
        if (operand && (operand.type === 'ident' || operand.type === 'str' || (operand.type === 'punct' && ')]'.includes(operand.value)))) return false;
      }
      return REGEX_AFTER_PUNCT.has(last.value);
    }
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
      if (close === -1) scan.unclosed ??= { what: 'block comment is not closed', start: i };
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
    // Шаблон - токен без значения: в `required` он нелитеральный элемент, а не пропавшая строка.
    if (c === '`') { const start = i; i = skipTemplate(text, i + 1, scan); tokens.push({ type: 'tmpl', start }); continue; }
    if (/[A-Za-z_$]/.test(c)) {
      const start = i;
      while (i < text.length && /[\w$]/.test(text[i])) i++;
      tokens.push({ type: 'ident', value: text.slice(start, i), start });
      continue;
    }
    if (!/\s/.test(c)) {
      const token = { type: 'punct', value: c, start: i };
      if (c === '(') {
        const before = tokens[tokens.length - 1];
        parens.push(before && before.type === 'ident' && CONDITION_WORDS.has(before.value));
      } else if (c === ')') {
        token.afterCondition = parens.pop() === true;
      }
      tokens.push(token);
    }
    i++;
  }
  return tokens;
}

const isName = (t) => t && (t.type === 'ident' || t.type === 'str');
const isPunct = (t, v) => t && t.type === 'punct' && t.value === v;

// Пара каждой скобки за один проход: разбор `properties` и `required` идёт до пары, а не сканом до конца
// файла от каждого ключа. Скобка без пары - находка: всё после неё сканер разбирает не как написано.
function matchBrackets(tokens, unjudged) {
  const match = new Map();
  const stack = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.type !== 'punct') continue;
    if ('([{'.includes(t.value)) stack.push(k);
    else if (PAIRS[t.value]) {
      const open = stack.pop();
      if (open === undefined || tokens[open].value !== PAIRS[t.value]) {
        unjudged.push({ start: t.start, what: `bracket "${t.value}" has no matching "${PAIRS[t.value]}"` });
        return match;
      }
      match.set(open, k);
    }
  }
  if (stack.length) unjudged.push({ start: tokens[stack[0]].start, what: `bracket "${tokens[stack[0]].value}" is not closed` });
  return match;
}

// Ключ объекта: имя или строка, за которой `:`, а перед которой `{` или `,` (так тернарный `? a : b`
// и `case x:` ключом не считаются).
function isKeyAt(tokens, k) {
  return isName(tokens[k]) && isPunct(tokens[k + 1], ':') && (isPunct(tokens[k - 1], '{') || isPunct(tokens[k - 1], ','));
}

// Ключи первого уровня объекта `{` на позиции open. Spread, вычисляемый ключ и shorthand на первом уровне
// `properties` не дают литерального перечня полей - это находка.
function objectKeys(tokens, open, close, unjudged, match) {
  const keys = [];
  for (let k = open + 1; k < close; k++) {
    const t = tokens[k];
    if (t.type === 'punct' && '{[('.includes(t.value)) {
      if (t.value === '[' && (isPunct(tokens[k - 1], '{') || isPunct(tokens[k - 1], ','))) {
        unjudged.push({ start: t.start, what: 'properties holds a computed key [...]' });
      }
      // Вложенный объект перепрыгивается по паре: его ключи судит его собственный разбор, а не повторный скан.
      if (!match.has(k)) break;
      k = match.get(k);
    } else if (isKeyAt(tokens, k)) keys.push(t);
    else if (isPunct(t, '.') && isPunct(tokens[k + 1], '.') && isPunct(tokens[k + 2], '.')) {
      unjudged.push({ start: t.start, what: 'properties holds a spread "..."' });
      k += 2;
    } else if (t.type === 'ident' && (isPunct(tokens[k - 1], '{') || isPunct(tokens[k - 1], ',')) && (isPunct(tokens[k + 1], ',') || isPunct(tokens[k + 1], '}'))) {
      unjudged.push({ start: t.start, what: `properties holds a shorthand key "${t.value}"` });
    }
  }
  return keys;
}

// Строки массива `[` на позиции open; первый нестроковый элемент (константа, шаблон, spread) - отдельно:
// порядок и написание такого перечня не судятся.
function arrayStrings(tokens, open, close) {
  const items = [];
  let nonLiteral = null;
  for (let k = open + 1; k < close; k++) {
    if (tokens[k].type === 'str') items.push(tokens[k]);
    else if (isPunct(tokens[k], '.')) nonLiteral ??= { value: '...spread', start: tokens[k].start };
    else if (tokens[k].type === 'tmpl') nonLiteral ??= { value: '`template`', start: tokens[k].start };
    else if (!isPunct(tokens[k], ',')) nonLiteral ??= tokens[k];
  }
  return { items, nonLiteral };
}

const LITERAL_WORDS = new Set(['true', 'false', 'null', 'undefined']);

// Чтения полей: `x.name`, `x['name']`, shorthand деструктуризации `{ name }` / `{ name, other }`. Приёмник
// берёт поле по имени, и расхождение на стороне чтения - тот же дефект, что на стороне объявления.
function readNames(tokens) {
  const reads = [];
  for (let k = 1; k < tokens.length; k++) {
    const t = tokens[k];
    const prev = tokens[k - 1];
    if (t.type === 'ident' && isPunct(prev, '.') && !isPunct(tokens[k - 2], '.')) {
      reads.push(t);
    } else if (t.type === 'str' && isPunct(prev, '[') && isPunct(tokens[k + 1], ']')) {
      const owner = tokens[k - 2];
      if (owner && (owner.type === 'ident' || isPunct(owner, ')') || isPunct(owner, ']'))) reads.push(t);
    } else if (t.type === 'ident' && (isPunct(prev, '{') || isPunct(prev, ',')) && (isPunct(tokens[k + 1], ',') || isPunct(tokens[k + 1], '}'))) {
      reads.push(t);
    }
  }
  return reads;
}

// Схема выхода узла - объект в `schema:` опций вызова: литерал на месте либо `const NAME = {...}`.
function schemaObjects(tokens, match, unjudged) {
  const consts = new Map();
  for (let k = 0; k + 3 < tokens.length; k++) {
    if (tokens[k].type === 'ident' && ['const', 'let', 'var'].includes(tokens[k].value) && tokens[k + 1].type === 'ident' && isPunct(tokens[k + 2], '=') && isPunct(tokens[k + 3], '{')) {
      consts.set(tokens[k + 1].value, k + 3);
    }
  }
  const schemas = [];
  for (let k = 0; k < tokens.length; k++) {
    if (!isKeyAt(tokens, k) || tokens[k].value !== 'schema') continue;
    const value = tokens[k + 2];
    let open = null;
    if (isPunct(value, '{')) open = k + 2;
    else if (value && value.type === 'ident' && consts.has(value.value) && (isPunct(tokens[k + 3], ',') || isPunct(tokens[k + 3], '}'))) open = consts.get(value.value);
    if (open === null || !match.has(open)) {
      if (value) unjudged.push({ start: value.start, what: `schema: ${value.type === 'ident' ? value.value : value.type === 'punct' ? value.value : value.type} is not a literal object or a const bound to one` });
      continue;
    }
    if (!schemas.includes(open)) schemas.push(open);
  }
  return schemas;
}

function parseTrack(text) {
  const scan = { unclosed: null };
  const tokens = tokenize(text, scan);
  const unjudged = [];
  const match = matchBrackets(tokens, unjudged);
  const keys = [];
  const requiredLists = [];
  for (let k = 0; k < tokens.length; k++) {
    if (!isKeyAt(tokens, k)) continue;
    keys.push(tokens[k]);
    const name = tokens[k].value;
    if (name !== 'required' && name !== 'properties') continue;
    const value = tokens[k + 2];
    const literalOpen = name === 'required' ? '[' : '{';
    if (isPunct(value, literalOpen) && match.has(k + 2)) {
      const close = match.get(k + 2);
      if (name === 'required') {
        const list = arrayStrings(tokens, k + 2, close);
        requiredLists.push({ items: list.items, open: k + 2 });
        if (list.nonLiteral) unjudged.push({ start: list.nonLiteral.start, what: `required: [...] holds a non-literal element "${list.nonLiteral.value}"` });
        if (isPunct(tokens[close + 1], '.')) unjudged.push({ start: tokens[close + 1].start, what: 'required: [...] is followed by a call, the list is not literal' });
      } else {
        objectKeys(tokens, k + 2, close, unjudged, match);
      }
    } else if (value && !(value.type === 'ident' && LITERAL_WORDS.has(value.value)) && !isPunct(value, literalOpen)) {
      const shown = value.type === 'ident' ? value.value : value.type === 'str' ? `'${value.value}'` : value.type === 'tmpl' ? '`template`' : value.value;
      unjudged.push({ start: value.start, what: `${name}: ${shown} is not a literal ${name === 'required' ? 'list' : 'object'}` });
    }
  }
  const schemas = schemaObjects(tokens, match, unjudged).map((open) => topLevelSchema(tokens, open, match.get(open), match));
  if (scan.unclosed) unjudged.push({ start: scan.unclosed.start, what: `${scan.unclosed.what}, the rest of the file is not scanned` });
  return { keys, requiredLists, reads: readNames(tokens), schemas, unjudged };
}

// Ключи `properties` и строки `required` первого уровня объекта-схемы.
function topLevelSchema(tokens, open, close, match) {
  const schema = { start: tokens[open].start, properties: null, required: null };
  for (let k = open + 1; k < close; k++) {
    const t = tokens[k];
    if (t.type === 'punct' && '{[('.includes(t.value)) {
      if (!match.has(k)) break;
      k = match.get(k);
    } else if (isKeyAt(tokens, k) && match.has(k + 2)) {
      if (t.value === 'properties' && isPunct(tokens[k + 2], '{')) schema.properties = objectKeys(tokens, k + 2, match.get(k + 2), [], match);
      if (t.value === 'required' && isPunct(tokens[k + 2], '[')) schema.required = arrayStrings(tokens, k + 2, match.get(k + 2)).items;
    }
  }
  return schema;
}

function collectFromTrack(parsed, lineAt) {
  const found = parsed.keys.map((t) => ({ name: t.value, where: 'ключ объекта', line: lineAt(t.start) }));
  for (const list of parsed.requiredLists) {
    for (const t of list.items) found.push({ name: t.value, where: 'перечень required', line: lineAt(t.start) });
  }
  for (const t of parsed.reads) found.push({ name: t.value, where: 'чтение поля', line: lineAt(t.start) });
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

// A.1 объявляет `status` первым полем выхода. Судится схема выхода узла - объект в `schema:` вызова: `status` в
// ней есть и стоит первым и в ключах `properties`, и в перечне `required`. Порядок `required` на валидацию не
// влияет (JSON Schema, `required` - множество имён), порядок `properties` - порядок объявления; правило держит
// конвенцию объявления, а не маршрут вызывающего: трек берёт `status` по имени. Вложенные объекты схемы
// (находка, звено) и объекты вне `schema:` своего исхода не несут и не судятся.
function validateStatusFirst(parsed, lineAt, findings) {
  const judge = (list, where, start) => {
    const names = list.map((t) => t.value);
    if (names[0] === 'status') return;
    findings.push({
      rule: 'contract-status-not-first',
      message: names.includes('status')
        ? `line ${lineAt(list[0].start)}: ${where} [${names.map((n) => `'${show(n)}'`).join(', ')}] declares 'status' at position ${names.indexOf('status') + 1} - node-contract A.1 declares it the first field of a node output`
        : `line ${lineAt(start)}: ${where} [${names.map((n) => `'${show(n)}'`).join(', ')}] of a node output schema declares no 'status' - node-contract A.1 declares it the first field of a node output`,
    });
  };
  for (const schema of parsed.schemas) {
    if (schema.properties) judge(schema.properties, 'properties', schema.start);
    if (schema.required) judge(schema.required, 'required:', schema.start);
  }
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
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('-'));
  const positional = args.filter((a) => !a.startsWith('-'));
  if (flags.length || positional.length > 1) {
    fail(`Usage: node tools/validate-node-contract.js [all | <plugins/**/agents/*.md | plugins/**/tracks/*.js>] - unexpected ${flags.length ? `option ${flags[0]}` : `argument ${positional[1]}`}`);
  }
  if (process.env.MARKETPLACE_ROOT === '') fail('MARKETPLACE_ROOT is set but empty - unset it or point it at a marketplace tree');
  const target = positional[0] || 'all';

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
