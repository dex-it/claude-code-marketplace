#!/usr/bin/env node
/**
 * Meta-validator: every rule a validator can emit must have a row in
 * docs/VALIDATOR_RULES.md, and every row must correspond to a live rule.
 *
 * Зачем: имя правила - единственное, что видит человек в выводе валидатора.
 * Правило без строки в реестре отсылает к чтению кода, а строка про удалённое
 * правило учит несуществующей норме. Обе стороны проверяются машинно, потому
 * что обе разъезжаются молча - валидаторы правятся чаще, чем доки.
 *
 *   `rule-not-documented`  - правило есть в коде, строки в реестре нет
 *   `rule-registry-stale`  - строка есть, правила в коде нет
 *   `rule-untested`        - у правила нет фикстуры в tools/__fixtures__
 *
 * Третье правило держит регрессию: правило без фикстуры проверено разово и
 * выключается молча (регулярка перестала матчить, ветка ушла под условие) -
 * прогон на живом каталоге этого не видит, там правило и должно молчать.
 *
 * Usage:
 *   node tools/validate-rules-documented.js [all]
 *
 * Exit codes:
 *   0 - clean
 *   1 - at least one error found
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js
// прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
const TOOLS_DIR = join(REPO_ROOT, 'tools');
const REGISTRY = join(REPO_ROOT, 'docs', 'VALIDATOR_RULES.md');
const FIXTURES_DIR = join(TOOLS_DIR, '__fixtures__');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

// Имя правила в записи находки - ключ `rule` с литералом в кавычках.
const RULE_RE = /rule:\s*['"]([a-z0-9-]+)['"]/g;
// Строка реестра: | `rule-name` | error | ... |
const REGISTRY_ROW_RE = /^\|\s*`([a-z0-9-]+)`\s*\|/gm;

function collectRulesFromCode() {
  const rules = new Map(); // rule -> Set(files)
  for (const entry of readdirSync(TOOLS_DIR)) {
    if (!entry.startsWith('validate-') || !entry.endsWith('.js')) continue;
    const text = readFileSync(join(TOOLS_DIR, entry), 'utf8');
    for (const m of text.matchAll(RULE_RE)) {
      const set = rules.get(m[1]) || new Set();
      set.add(entry);
      rules.set(m[1], set);
    }
  }
  return rules;
}

function collectRulesFromRegistry(text) {
  return new Set([...text.matchAll(REGISTRY_ROW_RE)].map((m) => m[1]));
}

function main() {
  if (!existsSync(REGISTRY)) {
    console.log(`${COLORS.red}ERROR${COLORS.reset} rule registry not found: docs/VALIDATOR_RULES.md`);
    process.exit(1);
  }

  const registryText = readFileSync(REGISTRY, 'utf8');
  const documented = collectRulesFromRegistry(registryText);
  const inCode = collectRulesFromCode();

  const findings = [];

  for (const [rule, files] of inCode) {
    if (documented.has(rule)) continue;
    findings.push({
      rule: 'rule-not-documented',
      message: `"${rule}" (${[...files].join(', ')}) has no row in docs/VALIDATOR_RULES.md - the rule name in the output must lead to a norm, not to reading the code`,
    });
  }

  for (const rule of documented) {
    if (inCode.has(rule)) continue;
    findings.push({
      rule: 'rule-registry-stale',
      message: `"${rule}" is listed in docs/VALIDATOR_RULES.md but no validator emits it - remove the row or restore the rule`,
    });
  }

  // Покрытие считается по паре (валидатор, правило): одно имя эмитят несколько
  // валидаторов (`read-failed`, `frontmatter-required`), и фикстура у одного из
  // них ничего не говорит про остальные.
  for (const [rule, files] of inCode) {
    for (const file of files) {
      const validator = file.replace(/^validate-/, '').replace(/\.js$/, '');
      if (existsSync(join(FIXTURES_DIR, validator, rule))) continue;
      findings.push({
        rule: 'rule-untested',
        message: `"${rule}" (${file}) has no fixture at tools/__fixtures__/${validator}/${rule}/ - a rule verified once switches off silently; the live catalogue cannot catch it, there the rule is supposed to stay quiet`,
      });
    }
  }

  if (findings.length > 0) {
    console.log(`\n${COLORS.bold}docs/VALIDATOR_RULES.md${COLORS.reset}`);
    for (const f of findings) {
      console.log(`  ${COLORS.red}ERROR${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`);
    }
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${inCode.size} rule(s) in code, ${documented.size} documented, ` +
      `${COLORS.red}${findings.length} error(s)${COLORS.reset}`
  );

  process.exit(findings.length > 0 ? 1 : 0);
}

main();
