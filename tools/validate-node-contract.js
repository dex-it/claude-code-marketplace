#!/usr/bin/env node
// Имена полей стыка в телах агентов и схемах треков против словаря node-contract; норма и Usage - docs/VALIDATOR_RULES.md.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { basename, join, relative, resolve, dirname } from 'node:path';
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
// Служебные ключи JSON Schema: имён полей контракта среди них не бывает.
const SCHEMA_KEYWORDS = new Set([
  'type', 'properties', 'items', 'required', 'enum', 'description', 'format',
  'additionalProperties', 'minItems', 'maxItems', 'minimum', 'maximum', 'default',
]);

// --- Dictionary ---------------------------------------------------------

function findDictionaryFile(dir) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const found = findDictionaryFile(full);
      if (found) return found;
    } else if (entry === 'SKILL.md' && basename(dir) === 'node-contract') {
      return full;
    }
  }
  return null;
}

function loadDictionary() {
  const file = findDictionaryFile(PLUGINS_DIR);
  if (!file) return null;
  const text = readFileSync(file, 'utf8');
  const start = text.indexOf(DICTIONARY_HEADING);
  if (start === -1) return null;
  const rest = text.slice(start + DICTIONARY_HEADING.length);
  const end = rest.indexOf('\n## ');
  const section = end === -1 ? rest : rest.slice(0, end);

  const names = new Set();
  for (const line of section.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) names.add(m[1]);
  }
  return names.size > 0 ? { file, names } : null;
}

// Разделитель и регистр - то, чем имя расходится молча; прочая разница делает его другим полем, а не другой записью.
function normalize(name) {
  return name.toLowerCase().replace(/[_\s]+/g, '-');
}

function buildSpellingIndex(names) {
  const index = new Map();
  for (const name of names) index.set(normalize(name), name);
  return index;
}

// --- Collecting candidate names ------------------------------------------

// В прозе агента имя поля стоит в backticks.
function collectFromAgent(text) {
  const found = [];
  for (const m of text.matchAll(/`([A-Za-z][A-Za-z0-9_ -]*)`/g)) {
    found.push({ name: m[1], where: 'тело агента' });
  }
  return found;
}

// Трек читается текстом: рантайма Workflow вне прогона нет, да и предмет здесь - написание.
function collectFromTrack(text) {
  const found = [];
  for (const m of text.matchAll(/^\s*'([^']+)'\s*:|^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)) {
    const name = m[1] || m[2];
    if (SCHEMA_KEYWORDS.has(name)) continue;
    found.push({ name, where: 'ключ схемы' });
  }
  for (const block of text.matchAll(/required:\s*\[([^\]]*)\]/g)) {
    for (const m of block[1].matchAll(/'([^']+)'/g)) {
      found.push({ name: m[1], where: 'перечень required' });
    }
  }
  return found;
}

// --- Rules ---------------------------------------------------------------

function validateSpelling(candidates, dict, index, findings) {
  const seen = new Set();
  for (const { name, where } of candidates) {
    const canonical = index.get(normalize(name));
    if (!canonical || canonical === name || dict.names.has(name)) continue;
    const key = `${name}|${where}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      rule: 'contract-field-spelling',
      message: `"${name}" (${where}) is the node-contract field \`${canonical}\` spelled differently - the receiver takes a field by name, and a renamed one reads as absent; write \`${canonical}\` verbatim`,
    });
  }
}

// Судится только перечень, где `status` уже есть: у вложенного объекта (находка, звено) своего исхода нет.
function validateStatusFirst(text, findings) {
  for (const block of text.matchAll(/required:\s*\[([^\]]*)\]/g)) {
    const names = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (!names.includes('status') || names[0] === 'status') continue;
    findings.push({
      rule: 'contract-status-not-first',
      message: `required: [${names.map((n) => `'${n}'`).join(', ')}] carries 'status' at position ${names.indexOf('status') + 1} - node-contract A.1 puts it first, the caller routes by the first field`,
    });
  }
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

  const isTrack = filepath.endsWith('.js');
  validateSpelling(isTrack ? collectFromTrack(text) : collectFromAgent(text), dict, index, findings);
  if (isTrack) validateStatusFirst(text, findings);

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

  // Словаря нет - судить нечем; исчезнувший скилл ловит validate-agent.js по ссылке `skills:` каждого агента.
  const dict = loadDictionary();
  if (!dict) {
    console.log('');
    console.log(`${COLORS.bold}Summary:${COLORS.reset} node-contract dictionary not found, nothing to judge`);
    process.exit(0);
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
