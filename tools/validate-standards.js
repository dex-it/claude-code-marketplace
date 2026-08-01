#!/usr/bin/env node
/**
 * Standards registry validator for Claude Code marketplace.
 *
 * Дом реестра - docs/standards/README.md. Он существует ради одного: чтобы
 * утверждение артефакта о стандарте прослеживалось до источника, а непроверенное
 * не выдавалось за проверенное. Оба свойства держатся на дисциплине записи, и
 * обе проверяются здесь машинно:
 *
 *   1. `registry-status-unknown` - статус строки вне закрытого перечня
 *      (`verified` / `indexed` / `unverifiable` / `contradicted`, правило 2
 *      реестра). Свободный текст в колонке статуса = статус, который никто не
 *      трактует одинаково.
 *   2. `registry-evidence-missing` - у `verified`/`indexed` нет ни даты сверки
 *      в самой строке, ни поля «Сверка» в шапке секции. Без даты и копии статус
 *      не подтверждается: он читается как `unverifiable`, но выглядит как
 *      проверенный.
 *   3. `standard-not-in-registry` - артефакт каталога (plugins/**, docs/**)
 *      ссылается на стандарт, которого в реестре нет. Правило 1 реестра:
 *      ссылка без строки считается неподтверждённой.
 *
 * Чего валидатор НЕ проверяет и не может: соответствие статуса реальности
 * (читали ли текст пункта). Это ручная работа ревьюера - см. правило 2 реестра.
 *
 * Usage:
 *   node tools/validate-standards.js          # реестр + потребители
 *   node tools/validate-standards.js registry # только реестр
 *
 * Exit codes:
 *   0 - clean
 *   1 - at least one error found
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const REGISTRY = join(REPO_ROOT, 'docs', 'standards', 'README.md');
const SCAN_DIRS = [join(REPO_ROOT, 'plugins'), join(REPO_ROOT, 'docs')];

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const ERROR = 'error';
const WARNING = 'warning';

const KNOWN_STATUSES = new Set(['verified', 'indexed', 'unverifiable', 'contradicted']);
const EVIDENCE_REQUIRED = new Set(['verified', 'indexed']);

// Дата сверки в строке основания: 01.08.2026 / 2026-08-01.
const DATE_RE = /\b(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})\b/;
// Отсылка к общему основанию правил реестра («п.7 правил») - дата там.
const RULE_REF_RE = /п\.\s*\d+\s+правил/;

/**
 * Номера стандартов, которые ищутся в артефактах. Ключ - как пишется в тексте,
 * значение - как встречается в заголовке секции реестра. Перечень закрыт
 * намеренно: открытый поиск «любое число рядом со словом ISO» даёт ложные
 * срабатывания на версиях библиотек и номерах RFC.
 */
const STANDARD_PATTERNS = [
  { re: /\b(?:ISO(?:\/IEC)?(?:\/IEEE)?\s*)?15289\b/, key: '15289' },
  { re: /\b(?:ISO(?:\/IEC)?(?:\/IEEE)?\s*)?12207\b/, key: '12207' },
  { re: /\b(?:ISO(?:\/IEC)?(?:\/IEEE)?\s*)?15288\b/, key: '15288' },
  { re: /\b(?:ISO(?:\/IEC)?(?:\/IEEE)?\s*)?29148\b/, key: '29148' },
  { re: /\b(?:ISO(?:\/IEC)?(?:\/IEEE)?\s*)?42010\b/, key: '42010' },
  { re: /\b(?:ISO(?:\/IEC)?(?:\/IEEE)?\s*)?29119-3\b/, key: '29119-3' },
  { re: /\b(?:ISO(?:\/IEC)?\s*)?25010\b/, key: '25010' },
  { re: /\bIEEE\s*1016\b/, key: '1016' },
  { re: /\bГОСТ\s*Р?\s*59793\b/, key: '59793' },
  { re: /\bГОСТ\s*Р?\s*59795\b/, key: '59795' },
  { re: /\bГОСТ\s*(?:Р\s*)?34\.602\b/, key: '34.602' },
  { re: /\bNASA\s+SP-2016-6105\b/, key: 'SP-2016-6105' },
  { re: /\bINCOSE\b/, key: 'INCOSE' },
];

// --- Registry parsing ---------------------------------------------------

/**
 * Разбор реестра на секции: заголовок `### ...`, признак наличия поля
 * «Сверка» в шапке секции и строки таблицы фактов.
 */
function parseRegistry(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^###\s+(.*)$/);
    if (heading) {
      current = { title: heading[1].trim(), hasSectionEvidence: false, inFactTable: false, rows: [] };
      sections.push(current);
      continue;
    }
    // Заголовок уровня 2 закрывает секцию стандарта: за «## Что лежит в sources/»
    // идут таблицы другой формы, и их колонки под статусы не отвести.
    if (/^##\s+/.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;

    if (/^-\s+\*\*Сверка:\*\*/.test(line)) {
      current.hasSectionEvidence = DATE_RE.test(line);
      continue;
    }

    if (!line.startsWith('|')) {
      current.inFactTable = false;
      continue;
    }
    const cells = line.split('|').slice(1, -1);
    // Таблица фактов опознаётся по своей шапке, а не по числу колонок: в секции
    // может стоять таблица другой формы, и тогда третья колонка - не статус.
    if (cells.length >= 4 && cells[2].trim() === 'Статус') {
      current.inFactTable = true;
      continue;
    }
    if (!current.inFactTable || cells.length < 4) continue;
    const statusCell = cells[2].trim();
    if (!statusCell || /^-+$/.test(statusCell)) continue;

    current.rows.push({
      line: i + 1,
      fact: cells[0].trim(),
      status: statusCell,
      evidence: cells[3].trim(),
    });
  }

  return sections;
}

function validateRegistry(text, findings) {
  for (const section of parseRegistry(text)) {
    for (const row of section.rows) {
      const status = (row.status.match(/`([a-z]+)`/) || [])[1];

      if (!status || !KNOWN_STATUSES.has(status)) {
        findings.push({
          level: ERROR,
          rule: 'registry-status-unknown',
          message: `Line ${row.line} ("${row.fact.slice(0, 60)}"): status "${row.status}" is outside the closed list [${[...KNOWN_STATUSES].join(', ')}] - see rule 2 of the registry`,
        });
        continue;
      }

      if (!EVIDENCE_REQUIRED.has(status)) continue;

      const hasRowEvidence = DATE_RE.test(row.evidence) || RULE_REF_RE.test(row.evidence);
      if (!hasRowEvidence && !section.hasSectionEvidence) {
        findings.push({
          level: ERROR,
          rule: 'registry-evidence-missing',
          message: `Line ${row.line} ("${row.fact.slice(0, 60)}"): status \`${status}\` requires a copy and a verification date - put them in the row's evidence cell or in the section's "**Сверка:**" field`,
        });
      }
    }
  }
}

// --- Consumers ----------------------------------------------------------

function collectMarkdownFiles(dir, out) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectMarkdownFiles(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

function validateConsumers(registryText, findings) {
  const present = new Set(
    STANDARD_PATTERNS.filter((p) => p.re.test(registryText)).map((p) => p.key)
  );

  const files = [];
  for (const dir of SCAN_DIRS) collectMarkdownFiles(dir, files);

  for (const file of files) {
    if (resolve(file) === REGISTRY) continue;
    const body = readFileSync(file, 'utf8');
    for (const { re, key } of STANDARD_PATTERNS) {
      if (present.has(key) || !re.test(body)) continue;
      findings.push({
        level: ERROR,
        rule: 'standard-not-in-registry',
        message: `${relative(REPO_ROOT, file)} references standard "${key}" which has no row in docs/standards/README.md - rule 1: a reference without a registry row counts as unconfirmed`,
      });
    }
  }
}

// --- Reporting ----------------------------------------------------------

function formatFinding(f) {
  const isWarning = f.level === WARNING;
  const color = isWarning ? COLORS.yellow : COLORS.red;
  const label = isWarning ? 'WARN ' : 'ERROR';
  return `  ${color}${label}${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`;
}

function main() {
  const mode = process.argv[2] || 'all';

  if (!existsSync(REGISTRY)) {
    console.log(`${COLORS.red}ERROR${COLORS.reset} standards registry not found: docs/standards/README.md`);
    process.exit(1);
  }

  const text = readFileSync(REGISTRY, 'utf8');
  const findings = [];

  validateRegistry(text, findings);
  if (mode !== 'registry') validateConsumers(text, findings);

  if (findings.length > 0) {
    console.log(`\n${COLORS.bold}docs/standards/README.md + consumers${COLORS.reset}`);
    for (const f of findings) console.log(formatFinding(f));
  }

  const errors = findings.filter((f) => f.level !== WARNING).length;
  const warnings = findings.length - errors;

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} standards registry checked, ` +
      `${COLORS.red}${errors} error(s)${COLORS.reset}, ` +
      `${COLORS.yellow}${warnings} warning(s)${COLORS.reset}`
  );

  process.exit(errors > 0 ? 1 : 0);
}

main();
