#!/usr/bin/env node
// Имена полей стыка в телах агентов и схемах треков против словаря node-contract; норма и Usage - docs/VALIDATOR_RULES.md.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
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

// --- Dictionary ---------------------------------------------------------

// Возвращает { names } либо { missing: причина }. Нечитаемый словарь - находка, а не пустой прогон:
// validate-agent.js неизвестный плагин объявляет вне области проверки, переименованный раздел не видит
// никто, и суд имён выключался бы зелёным. Нет файла, нет раздела, нет строк - один исход: имён ноль.
function loadDictionary() {
  const exists = existsSync(DICTIONARY_FILE);
  const text = exists ? readFileSync(DICTIONARY_FILE, 'utf8') : '';
  const start = text.indexOf(`\n${DICTIONARY_HEADING}\n`);
  let section = '';
  if (start !== -1) {
    const rest = text.slice(start + DICTIONARY_HEADING.length + 2);
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

function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

// --- Collecting candidate names ------------------------------------------

// В прозе агента имя поля стоит в backticks.
function collectFromAgent(text) {
  const found = [];
  for (const m of text.matchAll(/`([A-Za-z][A-Za-z0-9_ -]*)`/g)) {
    found.push({ name: m[1], where: 'тело агента', line: lineOf(text, m.index) });
  }
  return found;
}

// Трек читается текстом, а не исполняется: рантайма Workflow вне прогона нет, да и предмет здесь -
// написание. Построчный регэксп видел только ключ в начале строки и одинарные кавычки, поэтому трек
// разбирается сканером: строки обеих кавычек, комментарии и шаблонные строки (промпты узлам, в том числе
// вложенные через `${...}`) - отдельно от кода, ключ объекта - имя или строка между `{`/`,` и `:`.
function skipTemplate(text, i) {
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i + 1;
    if (c === '$' && text[i + 1] === '{') { i = skipInterpolation(text, i + 2); continue; }
    i++;
  }
  return i;
}

function skipInterpolation(text, i) {
  let depth = 1;
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (c === "'" || c === '"') {
      i++;
      while (i < text.length && text[i] !== c && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (c === '`') { i = skipTemplate(text, i + 1); continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return i;
}

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      const eol = text.indexOf('\n', i);
      i = eol === -1 ? text.length : eol;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      i = close === -1 ? text.length : close + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const start = i;
      let value = '';
      i++;
      while (i < text.length && text[i] !== c && text[i] !== '\n') {
        if (text[i] === '\\') { value += text[i + 1]; i += 2; continue; }
        value += text[i++];
      }
      i++;
      tokens.push({ type: 'str', value, start });
      continue;
    }
    if (c === '`') { i = skipTemplate(text, i + 1); continue; }
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

// Строки массива, открытого `[` на позиции open.
function arrayStrings(tokens, open) {
  const items = [];
  for (let k = open + 1; k < tokens.length && !isPunct(tokens[k], ']'); k++) {
    if (tokens[k].type === 'str') items.push(tokens[k]);
  }
  return items;
}

function parseTrack(text) {
  const tokens = tokenize(text);
  const keys = [];
  const requiredLists = [];
  const propertiesLists = [];
  for (let k = 0; k < tokens.length; k++) {
    if (!isKeyAt(tokens, k)) continue;
    keys.push(tokens[k]);
    if (tokens[k].value === 'required' && isPunct(tokens[k + 2], '[')) requiredLists.push(arrayStrings(tokens, k + 2));
    if (tokens[k].value === 'properties' && isPunct(tokens[k + 2], '{')) propertiesLists.push(objectKeys(tokens, k + 2));
  }
  return { keys, requiredLists, propertiesLists };
}

function collectFromTrack(text, parsed) {
  const found = parsed.keys.map((t) => ({ name: t.value, where: 'ключ схемы', line: lineOf(text, t.start) }));
  for (const list of parsed.requiredLists) {
    for (const t of list) found.push({ name: t.value, where: 'перечень required', line: lineOf(text, t.start) });
  }
  return found;
}

// --- Rules ---------------------------------------------------------------

// Каждое вхождение - своя находка со строкой: схлопнутые повторы всплывали по одному после каждой починки.
function validateSpelling(candidates, dict, index, findings) {
  const seen = new Set();
  for (const { name, where, line } of candidates) {
    const canonical = index.get(normalize(name));
    if (!canonical || dict.names.has(name)) continue;
    const key = `${name}|${where}|${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      rule: 'contract-field-spelling',
      message: `line ${line}: "${name}" (${where}) is the node-contract field \`${canonical}\` spelled differently - the receiver takes a field by name, and a renamed one reads as absent; write \`${canonical}\` verbatim`,
    });
  }
}

// A.1 объявляет `status` первым полем выхода. Судятся оба места, где схема задаёт порядок: ключи `properties`
// и перечень `required`. Порядок `required` на валидацию не влияет (JSON Schema, `required` - множество имён),
// порядок `properties` - порядок объявления; правило держит конвенцию объявления, а не маршрут вызывающего:
// трек берёт `status` по имени. Судится только объект, где `status` уже есть: у вложенного объекта (находка,
// звено) своего исхода нет.
function validateStatusFirst(text, parsed, findings) {
  const judge = (list, where) => {
    const names = list.map((t) => t.value);
    if (!names.includes('status') || names[0] === 'status') return;
    findings.push({
      rule: 'contract-status-not-first',
      message: `line ${lineOf(text, list[0].start)}: ${where} [${names.map((n) => `'${n}'`).join(', ')}] declares 'status' at position ${names.indexOf('status') + 1} - node-contract A.1 declares it the first field of a node output`,
    });
  };
  for (const list of parsed.propertiesLists) judge(list, 'properties');
  for (const list of parsed.requiredLists) judge(list, 'required:');
}

// --- Files ---------------------------------------------------------------

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
      const parent = dirname(full);
      if (entry.endsWith('.md') && parent.endsWith(`${'/'}agents`)) agents.push(full);
      else if (entry.endsWith('.js') && parent.endsWith(`${'/'}tracks`)) tracks.push(full);
    }
  }
  walk(PLUGINS_DIR);
  return [...agents.sort(), ...tracks.sort()];
}

function validateFile(filepath, dict, index) {
  const findings = [];
  // Файл только что найден обходом: нечитаемость здесь - отказ среды, и падение прогона громче тихой находки.
  const text = readFileSync(filepath, 'utf8');

  if (filepath.endsWith('.js')) {
    const parsed = parseTrack(text);
    validateSpelling(collectFromTrack(text, parsed), dict, index, findings);
    validateStatusFirst(text, parsed, findings);
  } else {
    validateSpelling(collectFromAgent(text), dict, index, findings);
  }

  return { filepath, findings };
}

// --- Reporting ----------------------------------------------------------

function report(results) {
  let totalErrors = 0;
  let filesWithIssues = 0;

  for (const result of results) {
    if (result.findings.length === 0) continue;
    totalErrors += result.findings.length;
    filesWithIssues += 1;
    console.log(`\n${COLORS.bold}${relative(REPO_ROOT, result.filepath)}${COLORS.reset}`);
    for (const f of result.findings) {
      console.log(`  ${COLORS.red}ERROR${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`);
    }
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} file(s) checked, ` +
      `${COLORS.red}${totalErrors} error(s)${COLORS.reset}` +
      (filesWithIssues > 0 ? `, ${filesWithIssues} file(s) with issues` : '')
  );

  return totalErrors > 0 ? 1 : 0;
}

// --- Main ---------------------------------------------------------------

function main() {
  const target = process.argv.slice(2).filter((a) => !a.startsWith('--'))[0] || 'all';

  const dict = loadDictionary();
  if (dict.missing) {
    process.exit(report([{
      filepath: DICTIONARY_FILE,
      findings: [{
        rule: 'contract-dictionary-missing',
        message: `node-contract field dictionary is unreadable (${dict.missing}) - no field name in agents or tracks can be judged; restore the "${DICTIONARY_HEADING}" table in ${relative(REPO_ROOT, DICTIONARY_FILE)}`,
      }],
    }]));
  }
  const index = buildSpellingIndex(dict.names);

  let files;
  if (target === 'all') {
    files = findFiles();
  } else {
    const abs = resolve(target);
    if (!existsSync(abs)) {
      console.error(`File not found: ${target}`);
      process.exit(1);
    }
    files = [abs];
  }

  process.exit(report(files.map((f) => validateFile(f, dict, index))));
}

main();
