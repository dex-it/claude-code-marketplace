#!/usr/bin/env node
/**
 * Sample package validator for Claude Code marketplace.
 *
 * Образцы в docs/sample/** - это эталон того, как выглядит выход конвейера.
 * Их читают и модель, и человек, поэтому расхождение образца с контрактом
 * `node-contract` дороже обычной опечатки: оно учит неверной форме. Машинно
 * проверяется то, что в контракте задано закрытыми перечнями:
 *
 *   1. `sample-verdict-unknown` - `verdict` вне перечня `node-contract` п.7
 *      (`passed` / `failed` / `unverifiable`).
 *   2. `sample-stage-unknown` - `stage` вне лестницы `node-contract`
 *      (`draft` -> `complete` -> `checked` -> `approved`).
 *   3. `sample-verdict-status-conflict` - `verdict: failed` в пакете, который
 *      отдаёт `status: complete`. `verdict` несёт финальное состояние артефакта,
 *      а не историю прогонов: находка, закрытая здесь же, даёт `passed`, а
 *      незакрытое выражается стадией и `status: partial`. `failed` рядом с
 *      `complete` значит, что одно из двух записано неверно. Считается по
 *      директории прогона: `status` пакета живёт в handoff, вердикты уровней -
 *      в файлах своих артефактов, и по одному файлу конфликт не собирается.
 *   4. `sample-stage-missing` - артефакт несёт `quality-checks`, но не несёт
 *      стадию. Оракулы прогнаны, а readiness артефакта не назван - приёмник
 *      трактует это как нехватку обязательного поля.
 *
 * Usage:
 *   node tools/validate-samples.js [all]
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
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js
// прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
const SAMPLES_DIR = join(REPO_ROOT, 'docs', 'sample');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const ERROR = 'error';
const WARNING = 'warning';

const VERDICTS = new Set(['passed', 'failed', 'unverifiable']);
const STAGES = new Set(['draft', 'complete', 'checked', 'approved']);

// Вердикт записывается двумя формами, и правило обязано видеть обе: литералом
// (`verdict: passed`, запись `{artifact: ..., verdict: passed}`) и значением
// колонки таблицы, шапка которой несёт «Вердикт»/`verdict` - пакеты каталога
// пишут вердикты уровней именно колонкой, и поиск одного литерала их не видит.
const VERDICT_RE = /verdict:\s*`?([a-z-]+)`?/gi;
const VERDICT_HEADER_RE = /вердикт|verdict/i;
const TABLE_VALUE_RE = /`([a-z-]+)`/;
// Стадия в таблице: | `stage` | `checked` (...) |  либо  | Стадия | `checked` |
const STAGE_RE = /\|\s*(?:`stage`|Стадия)\s*\|\s*`([a-z-]+)`/gi;
// Статус узла: | `status` | `complete` |
const STATUS_RE = /\|\s*`status`\s*\|\s*`([a-z-]+)`/gi;

function collectMarkdownFiles(dir, out) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectMarkdownFiles(full, out);
    else if (entry.endsWith('.md')) out.push(full);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function collectVerdicts(text) {
  const found = new Map();
  const add = (value, line) => {
    const key = `${line}:${value}`;
    if (!found.has(key)) found.set(key, { value, line });
  };

  for (const m of text.matchAll(VERDICT_RE)) add(m[1], lineOf(text, m.index));

  const lines = text.split('\n');
  let col = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trimStart().startsWith('|')) {
      col = -1;
      continue;
    }
    const cells = tableCells(lines[i]);
    const next = lines[i + 1] ? tableCells(lines[i + 1]) : [];
    // Шапка опознаётся только по строке-разделителю под ней: слово «verdict» в
    // ячейке данных иначе назначает колонкой вердикта соседнюю - там `stage`.
    if (next.length > 1 && next.every((c) => /^:?-+:?$/.test(c))) {
      col = cells.findIndex((c) => VERDICT_HEADER_RE.test(c));
      continue;
    }
    if (col === -1 || cells.every((c) => /^:?-+:?$/.test(c))) continue;
    const m = (cells[col] || '').match(TABLE_VALUE_RE);
    if (m) add(m[1], i + 1);
  }

  return [...found.values()].sort((a, b) => a.line - b.line);
}

// Прогон - снимок выхода на момент своей нормы. Помеченный в реестре историческим с
// названной причиной судится мягко: правится норма, а снимок снимается новым прогоном.
function historicalRuns() {
  const registry = join(SAMPLES_DIR, 'README.md');
  if (!existsSync(registry)) return new Map();
  const out = new Map();
  for (const line of readFileSync(registry, 'utf8').split('\n')) {
    if (!line.trimStart().startsWith('|')) continue;
    const dir = line.match(/\]\(([^)/]+)\/[^)]*\)/);
    const reason = line.match(/\|\s*исторический:\s*([^|]{10,})/);
    if (dir && reason) out.set(dir[1], reason[1].trim());
  }
  return out;
}

// Директория прогона: пакет - единица проверки, файл в корне docs/sample сам себе пакет.
function runKeyOf(filepath) {
  const rel = relative(SAMPLES_DIR, filepath);
  const [head] = rel.split(/[\\/]/);
  return head;
}

function validateSample(filepath) {
  const findings = [];
  const text = readFileSync(filepath, 'utf8');

  const verdicts = collectVerdicts(text);
  for (const v of verdicts) {
    if (!VERDICTS.has(v.value)) {
      findings.push({
        level: ERROR,
        rule: 'sample-verdict-unknown',
        message: `Line ${v.line}: verdict "${v.value}" is outside the closed list [${[...VERDICTS].join(', ')}] (node-contract п.7)`,
      });
    }
  }

  const stages = [];
  for (const m of text.matchAll(STAGE_RE)) {
    stages.push({ value: m[1], line: lineOf(text, m.index) });
    if (!STAGES.has(m[1])) {
      findings.push({
        level: ERROR,
        rule: 'sample-stage-unknown',
        message: `Line ${lineOf(text, m.index)}: stage "${m[1]}" is outside the ladder [${[...STAGES].join(' -> ')}] (node-contract)`,
      });
    }
  }

  const statuses = [...text.matchAll(STATUS_RE)].map((m) => m[1]);

  // Стадия ищется и в тексте («стадия требований - `checked`»), не только в
  // таблице: пакет может назвать её прозой, и это не нарушение. Голое значение
  // лестницы за упоминание не считается - `complete` живёт и в строке `status`,
  // и такой поиск гасил правило на любом пакете со `status: complete`.
  const mentionsStage =
    stages.length > 0 ||
    /`stage`/.test(text) ||
    /стади[а-я]{0,3}[^.\n]{0,80}`(draft|complete|checked|approved)`/i.test(text);
  if (/quality-checks/.test(text) && !mentionsStage) {
    findings.push({
      level: ERROR,
      rule: 'sample-stage-missing',
      message: 'File carries `quality-checks` but never states the artifact stage - oracles ran, readiness is unnamed (node-contract: an unset field is a missing mandatory field, not `draft`)',
    });
  }

  return { filepath, findings, verdicts, statuses };
}

function checkPackages(results) {
  const runs = new Map();
  for (const r of results) {
    const key = runKeyOf(r.filepath);
    if (!runs.has(key)) runs.set(key, []);
    runs.get(key).push(r);
  }

  for (const [run, files] of runs) {
    const complete = files.find((f) => f.statuses.includes('complete'));
    if (!complete) continue;
    for (const f of files) {
      for (const v of f.verdicts.filter((v) => v.value === 'failed')) {
        f.findings.push({
          level: ERROR,
          rule: 'sample-verdict-status-conflict',
          message: `Line ${v.line}: verdict \`failed\` in package "${run}", which reports \`status: complete\` (${relative(REPO_ROOT, complete.filepath)}) - verdict carries the artifact's final state, not the run history. Either the finding is closed (\`passed\`, history goes to the gate journal in prose) or the node is not complete (\`partial\`)`,
        });
      }
    }
  }
}

function formatFinding(f) {
  const isWarning = f.level === WARNING;
  const color = isWarning ? COLORS.yellow : COLORS.red;
  const label = isWarning ? 'WARN ' : 'ERROR';
  return `  ${color}${label}${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`;
}

function main() {
  const files = collectMarkdownFiles(SAMPLES_DIR, []);
  const results = files.map(validateSample);
  checkPackages(results);

  const historical = historicalRuns();
  for (const r of results) {
    const reason = historical.get(runKeyOf(r.filepath));
    if (!reason) continue;
    for (const f of r.findings) {
      f.level = WARNING;
      f.message = `historical run (${reason}): ${f.message}`;
    }
  }

  let errors = 0;
  let warnings = 0;
  for (const result of results) {
    if (result.findings.length === 0) continue;
    errors += result.findings.filter((f) => f.level !== WARNING).length;
    warnings += result.findings.filter((f) => f.level === WARNING).length;
    console.log(`\n${COLORS.bold}${relative(REPO_ROOT, result.filepath)}${COLORS.reset}`);
    for (const f of result.findings) console.log(formatFinding(f));
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${results.length} sample file(s) checked, ` +
      `${COLORS.red}${errors} error(s)${COLORS.reset}, ` +
      `${COLORS.yellow}${warnings} warning(s)${COLORS.reset}`
  );

  process.exit(errors > 0 ? 1 : 0);
}

main();
