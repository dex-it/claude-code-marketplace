#!/usr/bin/env node
/**
 * Витрина README против витрины каталога: назван ли каждый плагин.
 *
 * Зачем: `README.md` - второй носитель состава каталога, и генератора у него нет,
 * он правится руками. Замер 01.09.2026 этим же инструментом на базе PR (`b846fd6f`)
 * показал цену: 85 плагинов из 245 не были названы ни одной из двух форм. Расхождение молчаливое - `sync-marketplace.js --check` судит
 * только пару `plugin.json` x `marketplace.json` и README не видит.
 *
 * Что судится: КАЖДЫЙ плагин витрины назван в README хотя бы одной из двух форм -
 * полным именем (`dex-architect`) либо каноничным коротким (`architect` для
 * бандла, `ddd` для скилла). Две формы, а не одна, потому что README называет
 * агентов полным именем плагина, а бандлы и скиллы - коротким: это его
 * конвенция, а не разнобой, и правило судит по ней.
 *
 * Сверка идёт в обе стороны. Прямая: каждый плагин витрины назван в README.
 * Обратная: каждая строка таблицы README, открывающаяся именем `dex-*`, ведёт на
 * существующий плагин - иначе переименование оставляет строку, показывающую на
 * мёртвое имя, и односторонний гейт остаётся зелёным на ней.
 *
 * Чего НЕ судится: содержание строки. Устаревшее описание правило не ловит -
 * его ловит ревью. Предмет здесь один: состав, а не текст.
 *
 * Usage:
 *   node tools/check-readme-coverage.js          # отчёт
 *   node tools/check-readme-coverage.js --check  # то же, код возврата 1 при недостаче
 *
 * Exit codes:
 *   0 - все плагины названы
 *   1 - есть неназванные (только с --check)
 *   2 - витрина или README не прочитаны
 */

import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');

let catalog;
let readme;
try {
  catalog = JSON.parse(readFileSync(join(REPO_ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'));
  readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
} catch (e) {
  console.error(`Не прочитано: ${e.message}`);
  process.exit(2);
}
const plugins = catalog.plugins;
if (!Array.isArray(plugins)) {
  console.error('В marketplace.json нет массива `plugins` - витрину не с чем сверять');
  process.exit(2);
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const shortNameOf = (name) => name.replace(/^dex-(bundle-|skill-)?/, '');

const missing = [];
for (const p of plugins) {
  const short = shortNameOf(p.name);
  if (readme.includes(p.name)) continue;
  if (new RegExp(`(^|[^\\w-])${escape(short)}([^\\w-]|$)`).test(readme)) continue;
  missing.push(p.name);
}

// Обратная сторона: строка таблицы, открывающаяся именем плагина, ведёт на живое имя.
// Разбирается ровно эта форма (`| dex-... |` в начале строки) - конвенция витрины
// README; прозаические упоминания плагина в предмет не входят, у них нет обещания
// вести на запись каталога.
const named = new Set(catalog.plugins.map((p) => p.name));
const ghosts = [...readme.matchAll(/^\|\s*(dex-[a-z0-9-]+)\s*\|/gm)]
  .map((m) => m[1])
  .filter((n) => !named.has(n));
const ghostList = [...new Set(ghosts)];

// Версия каталога в подвале README - третий её носитель, и он уже расходился:
// на develop b846fd6f подвал стоял на 5.4.0 при 5.85.0 в витрине. Сверяется
// ровно строка подвала, а не любое вхождение номера в текст.
const footer = /\*\*DEX Team\*\*[^\n]*?Version\s+(\d+\.\d+\.\d+)/.exec(readme);
const versionOk = footer != null && footer[1] === catalog.version;

if (missing.length === 0 && ghostList.length === 0 && versionOk) {
  console.log(`витрина README полна: ${plugins.length} плагин(ов) названы, мёртвых строк нет, версия ${catalog.version}`);
  process.exit(0);
}
if (missing.length > 0) {
  console.error(`в README не назван ни одной формой: ${missing.length} из ${plugins.length}`);
  for (const n of missing) console.error(`  ${n}`);
}
if (ghostList.length > 0) {
  console.error(`строка README ведёт на имя, которого нет в витрине: ${ghostList.length}`);
  for (const n of ghostList) console.error(`  ${n}`);
}
if (!versionOk) {
  console.error(
    footer == null
      ? 'в подвале README не найдена строка версии каталога («**DEX Team** ... Version X.Y.Z»)'
      : `версия в подвале README (${footer[1]}) не равна версии витрины (${catalog.version})`,
  );
}
process.exit(CHECK ? 1 : 0);
