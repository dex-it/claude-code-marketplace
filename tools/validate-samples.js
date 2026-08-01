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
 *      (`draft` -> `complete` -> `checked` -> `baselined`).
 *   3. `sample-verdict-status-conflict` - `verdict: failed` в файле, который
 *      отдаёт `status: complete`. `verdict` несёт финальное состояние артефакта,
 *      а не историю прогонов: находка, закрытая здесь же, даёт `passed`, а
 *      незакрытое выражается стадией и `status: partial`. `failed` рядом с
 *      `complete` значит, что одно из двух записано неверно.
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
const STAGES = new Set(['draft', 'complete', 'checked', 'baselined']);

// `verdict: passed` в тексте и в записи `{artifact: ..., verdict: passed}`.
const VERDICT_RE = /verdict:\s*`?([a-z-]+)`?/gi;
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

function validateSample(filepath) {
  const findings = [];
  const text = readFileSync(filepath, 'utf8');

  const verdicts = [];
  for (const m of text.matchAll(VERDICT_RE)) {
    verdicts.push({ value: m[1], line: lineOf(text, m.index) });
    if (!VERDICTS.has(m[1])) {
      findings.push({
        level: ERROR,
        rule: 'sample-verdict-unknown',
        message: `Line ${lineOf(text, m.index)}: verdict "${m[1]}" is outside the closed list [${[...VERDICTS].join(', ')}] (node-contract п.7)`,
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

  const failed = verdicts.find((v) => v.value === 'failed');
  if (failed && statuses.includes('complete')) {
    findings.push({
      level: ERROR,
      rule: 'sample-verdict-status-conflict',
      message: `Line ${failed.line}: verdict \`failed\` sits next to \`status: complete\` - verdict carries the artifact's final state, not the run history. Either the finding is closed (\`passed\`, history goes to the gate journal) or the node is not complete (\`partial\`)`,
    });
  }

  // Стадия ищется и в тексте («стадия требований - `checked`»), не только в
  // таблице: пакет может назвать её прозой, и это не нарушение. Голое значение
  // лестницы за упоминание не считается - `complete` живёт и в строке `status`,
  // и такой поиск гасил правило на любом пакете со `status: complete`.
  const mentionsStage =
    stages.length > 0 ||
    /`stage`/.test(text) ||
    /стади[а-я]{0,3}[^.\n]{0,80}`(draft|complete|checked|baselined)`/i.test(text);
  if (/quality-checks/.test(text) && !mentionsStage) {
    findings.push({
      level: ERROR,
      rule: 'sample-stage-missing',
      message: 'File carries `quality-checks` but never states the artifact stage - oracles ran, readiness is unnamed (node-contract: an unset field is a missing mandatory field, not `draft`)',
    });
  }

  return { filepath, findings };
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
