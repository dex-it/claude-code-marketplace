#!/usr/bin/env node
/**
 * Регрессия правил валидаторов: каждое правило прогоняется на фикстуре.
 *
 * Зачем: валидаторы правятся чаще, чем каталог, и правило выключается молча -
 * регулярка перестала матчить, ветка ушла под условие, порог разъехался. Прогон
 * на живом каталоге этого не ловит: там правило и должно молчать. Ловит только
 * дерево, где дефект заведомо есть.
 *
 * Проба двусторонняя, и вторая сторона общая для всех фикстур: `_base` - дерево,
 * дающее ноль находок всеми валидаторами. Фикстура - оверлей поверх базы, то
 * есть в песочнице ровно один внесённый дефект. Правило, сработавшее без
 * оверлея, валит проверку базы; правило, не сработавшее с оверлеем, валит свою
 * фикстуру.
 *
 * Устройство:
 *   tools/__fixtures__/_base/                     эталон нулевых находок
 *   tools/__fixtures__/<validator>/<rule>/        оверлей поверх базы
 *   tools/__fixtures__/<validator>/<rule>/expect.json   {"also": [...]} - опц.
 *
 * Ожидание строгое: набор сработавших правил равен `{<rule>} + also`. Побочное
 * правило, не названное в `also`, - ошибка фикстуры: неучтённая побочка
 * маскирует поломку соседнего правила.
 *
 * Usage:
 *   node tools/test-rules.js [all|<validator>|<validator>/<rule>]
 *
 * Exit codes:
 *   0 - all fixtures pass
 *   1 - at least one fixture failed
 */

import { readFileSync, readdirSync, existsSync, statSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const TOOLS_DIR = join(REPO_ROOT, 'tools');
const FIXTURES_DIR = join(TOOLS_DIR, '__fixtures__');
const BASE_DIR = join(FIXTURES_DIR, '_base');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

const VALIDATORS = ['agent', 'skill', 'command', 'bundle', 'standards', 'samples', 'rules-documented'];

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const FINDING_RE = /^\s*(ERROR|WARN)\s+\[([a-z0-9-]+)\]/;
// Имя правила в записи находки валидатора.
const RULE_IN_CODE_RE = /rule:\s*['"]([a-z0-9-]+)['"]/g;

function runValidator(validator, root) {
  const result = spawnSync('node', [join(TOOLS_DIR, `validate-${validator}.js`), 'all'], {
    cwd: REPO_ROOT,
    env: { ...process.env, MARKETPLACE_ROOT: root },
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const rules = new Set();
  for (const line of output.split('\n')) {
    const m = line.replace(ANSI_RE, '').match(FINDING_RE);
    if (m) rules.add(m[2]);
  }
  return { rules, output };
}

function withSandbox(overlayDir, fn) {
  const sandbox = mkdtempSync(join(tmpdir(), 'mp-rule-fixture-'));
  try {
    cpSync(BASE_DIR, sandbox, { recursive: true });
    if (overlayDir) {
      cpSync(overlayDir, sandbox, {
        recursive: true,
        filter: (src) => !src.endsWith('expect.json'),
      });
    }
    return fn(sandbox);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

function collectRulesInCode() {
  const byValidator = new Map();
  for (const validator of VALIDATORS) {
    const file = join(TOOLS_DIR, `validate-${validator}.js`);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    byValidator.set(validator, new Set([...text.matchAll(RULE_IN_CODE_RE)].map((m) => m[1])));
  }
  return byValidator;
}

function collectFixtures(target) {
  const fixtures = [];
  for (const validator of readdirSync(FIXTURES_DIR)) {
    if (validator.startsWith('_')) continue;
    const validatorDir = join(FIXTURES_DIR, validator);
    if (!statSync(validatorDir).isDirectory()) continue;
    for (const rule of readdirSync(validatorDir)) {
      const dir = join(validatorDir, rule);
      if (!statSync(dir).isDirectory()) continue;
      const expectFile = join(dir, 'expect.json');
      const expect = existsSync(expectFile) ? JSON.parse(readFileSync(expectFile, 'utf8')) : {};
      fixtures.push({ validator, rule, dir, also: expect.also || [] });
    }
  }
  if (!target || target === 'all') return fixtures;
  return fixtures.filter((f) => f.validator === target || `${f.validator}/${f.rule}` === target);
}

function checkBase(failures) {
  withSandbox(null, (sandbox) => {
    for (const validator of VALIDATORS) {
      const { rules, output } = runValidator(validator, sandbox);
      if (rules.size === 0) continue;
      failures.push({
        name: `_base x validate-${validator}`,
        message: `base tree must be clean, but raised: ${[...rules].join(', ')}`,
        output,
      });
    }
  });
}

function checkFixture(fixture, rulesInCode, failures) {
  const known = rulesInCode.get(fixture.validator);
  if (known && !known.has(fixture.rule)) {
    failures.push({
      name: `${fixture.validator}/${fixture.rule}`,
      message: `validate-${fixture.validator}.js does not emit rule "${fixture.rule}" - fixture is filed under the wrong validator or the rule was renamed`,
    });
    return;
  }

  withSandbox(fixture.dir, (sandbox) => {
    const { rules, output } = runValidator(fixture.validator, sandbox);
    const expected = new Set([fixture.rule, ...fixture.also]);
    const missing = [...expected].filter((r) => !rules.has(r));
    const unexpected = [...rules].filter((r) => !expected.has(r));

    if (missing.length === 0 && unexpected.length === 0) return;

    const parts = [];
    if (missing.length > 0) parts.push(`did not raise: ${missing.join(', ')}`);
    if (unexpected.length > 0) parts.push(`raised unlisted: ${unexpected.join(', ')} (add to expect.json "also" or narrow the overlay)`);
    failures.push({ name: `${fixture.validator}/${fixture.rule}`, message: parts.join('; '), output });
  });
}

function main() {
  const target = process.argv[2] || 'all';

  if (!existsSync(BASE_DIR)) {
    console.log(`${COLORS.red}ERROR${COLORS.reset} fixture base not found: tools/__fixtures__/_base`);
    process.exit(1);
  }

  const failures = [];
  const rulesInCode = collectRulesInCode();
  const fixtures = collectFixtures(target);

  if (target === 'all' || VALIDATORS.includes(target)) checkBase(failures);
  for (const fixture of fixtures) checkFixture(fixture, rulesInCode, failures);

  for (const f of failures) {
    console.log(`\n${COLORS.bold}${f.name}${COLORS.reset}`);
    console.log(`  ${COLORS.red}FAIL${COLORS.reset} ${f.message}`);
    if (f.output) {
      const body = f.output.replace(ANSI_RE, '').split('\n').filter(Boolean).slice(0, 12);
      for (const line of body) console.log(`  ${COLORS.gray}| ${line}${COLORS.reset}`);
    }
  }

  console.log('');
  const passed = fixtures.length - failures.filter((f) => !f.name.startsWith('_base')).length;
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${fixtures.length} fixture(s), ` +
      `${COLORS.green}${passed} passed${COLORS.reset}, ` +
      `${COLORS.red}${failures.length} failure(s)${COLORS.reset}`
  );

  process.exit(failures.length > 0 ? 1 : 0);
}

main();
