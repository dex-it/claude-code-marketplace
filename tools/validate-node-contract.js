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
    found.push({ name: m[1] || m[2], where: 'ключ схемы' });
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
    if (!canonical || dict.names.has(name)) continue;
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
