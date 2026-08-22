#!/usr/bin/env node
/**
 * Генератор каталожной копии полей плагина: `plugin.json` -> `.claude-plugin/marketplace.json`.
 *
 * Зачем: `description` и `version` живут в двух носителях сразу, и второй никто
 * не читает. Зондом 22.08.2026 проверено: при расхождении установленный плагин
 * показывает описание из `plugin.json` (`claude plugin details`), каталожное не
 * видно нигде после установки; правила приоритета документация не даёт вовсе -
 * для соседних полей (`displayName`, `defaultEnabled`) даёт, для `description`
 * молчит. Отсюда дом один - `plugin.json`, а запись каталога генерируется.
 *
 * Копия в каталоге не удалена, а сгенерирована: поведение браузера каталога ДО
 * установки (`/plugin` TUI) не наблюдаемо из CLI, и падение на fallback стоило
 * бы 230 пустых описаний в витрине.
 *
 * Трогает ровно два поля записи. Всё остальное (`source`, `category`,
 * `keywords`, порядок записей, форматирование) остаётся как есть.
 *
 * Usage:
 *   node tools/sync-marketplace.js           # записать
 *   node tools/sync-marketplace.js --check   # только показать расхождения (exit 1)
 *
 * Exit codes:
 *   0 - синхронно (или записано)
 *   1 - --check и расхождения есть
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
const MARKETPLACE_JSON = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');

const checkOnly = process.argv.includes('--check');

const market = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));
const drift = [];
const missing = [];

for (const entry of market.plugins || []) {
  if (!entry || !entry.source) continue;
  const manifest = join(REPO_ROOT, entry.source.replace(/^\.\//, ''), '.claude-plugin', 'plugin.json');
  if (!existsSync(manifest)) {
    missing.push(`${entry.name}: нет ${entry.source}/.claude-plugin/plugin.json`);
    continue;
  }
  const pj = JSON.parse(readFileSync(manifest, 'utf8'));
  for (const field of ['description', 'version']) {
    if (typeof pj[field] !== 'string') continue;
    if (entry[field] === pj[field]) continue;
    drift.push(`${entry.name} [${field}]\n    каталог:     ${entry[field] ?? '(нет)'}\n    plugin.json: ${pj[field]}`);
    entry[field] = pj[field];
  }
}

for (const m of missing) console.log(`  ПРОПУЩЕН ${m}`);
for (const d of drift) console.log(`  ${d}`);

if (drift.length === 0) {
  console.log(`синхронно: ${market.plugins.length} записей`);
  process.exit(0);
}

if (checkOnly) {
  console.log(`\nрасхождений: ${drift.length} - выполни \`npm run sync:marketplace\``);
  process.exit(1);
}

writeFileSync(MARKETPLACE_JSON, JSON.stringify(market, null, 2) + '\n');
console.log(`\nзаписано в marketplace.json: ${drift.length} поле(й)`);
