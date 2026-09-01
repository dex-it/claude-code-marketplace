#!/usr/bin/env node
/**
 * Витрина README против витрины каталога: назван ли каждый плагин.
 *
 * Зачем: `README.md` - второй носитель состава каталога, и генератора у него нет,
 * он правится руками. Замер 01.09.2026 показал цену: 83 плагина из 245 не были
 * упомянуты вовсе. Расхождение молчаливое - `sync-marketplace.js --check` судит
 * только пару `plugin.json` x `marketplace.json` и README не видит.
 *
 * Что судится: КАЖДЫЙ плагин витрины назван в README хотя бы одной из двух форм -
 * полным именем (`dex-architect`) либо каноничным коротким (`architect` для
 * бандла, `ddd` для скилла). Две формы, а не одна, потому что README называет
 * агентов полным именем плагина, а бандлы и скиллы - коротким: это его
 * конвенция, а не разнобой, и правило судит по ней.
 *
 * Чего НЕ судится: содержание строки. Устаревшее описание правило не ловит -
 * его ловит ревью. Предмет здесь один: плагин появился, а в витрине его нет.
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

let plugins;
let readme;
try {
  plugins = JSON.parse(readFileSync(join(REPO_ROOT, '.claude-plugin', 'marketplace.json'), 'utf8')).plugins;
  readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
} catch (e) {
  console.error(`Не прочитано: ${e.message}`);
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

if (missing.length === 0) {
  console.log(`витрина README полна: ${plugins.length} плагин(ов) названы`);
  process.exit(0);
}
console.error(`в README не назван ни одной формой: ${missing.length} из ${plugins.length}`);
for (const n of missing) console.error(`  ${n}`);
process.exit(CHECK ? 1 : 0);
