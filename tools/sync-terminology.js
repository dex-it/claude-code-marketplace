#!/usr/bin/env node
/**
 * Генератор стартового индекса имён: `docs/domain/domain-model.md` -> `.claude/rules/terminology.md`.
 *
 * Зачем: словарь - дизайн-тайм документ на 38 КБ, и по ссылке в него никто не
 * ходит до того, как имя уже написано. Индекс кладёт в стартовый контекст ровно
 * то, что нужно ДО письма: какие имена заведены и какие запрещены. Значение,
 * дом и «не путать с» остаются в словаре - индекс их не дублирует, поэтому
 * второй формулировки нормы не возникает.
 *
 * Носитель - правило без `paths`: такие грузятся каждую сессию «with the same
 * priority as `.claude/CLAUDE.md`» и входят в стартовый контекст каждого
 * кастомного и плагинного субагента как project rules
 * (code.claude.com/docs/en/memory, «Organize rules with .claude/rules/»;
 * code.claude.com/docs/en/sub-agents, «What loads at startup»; сверено
 * 01.09.2026). Path-scoped правило не подошло бы: оно грузится, когда Claude
 * читает подходящий файл, то есть уже после того, как имя выбрано.
 *
 * Usage:
 *   node tools/sync-terminology.js           # записать
 *   node tools/sync-terminology.js --check   # только показать расхождение (exit 1)
 *
 * Exit codes:
 *   0 - синхронно (или записано)
 *   1 - --check и расхождение есть; либо словарь не распарсился
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');
const SOURCE = join(REPO_ROOT, 'docs', 'domain', 'domain-model.md');
const TARGET = join(REPO_ROOT, '.claude', 'rules', 'terminology.md');

const checkOnly = process.argv.includes('--check');

/** Строки markdown-таблицы: ячейки без разделителя `|---|` и без шапки. */
function tableRows(lines, from) {
  const rows = [];
  for (let i = from; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) break;
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    rows.push(cells);
  }
  return rows;
}

const src = readFileSync(SOURCE, 'utf8').split('\n');

const terms = [];
const oust = [];
const homeless = [];
let fatal = null;

for (let i = 0; i < src.length; i++) {
  if (!src[i].startsWith('| Термин ')) continue;
  const header = src[i];
  const rows = tableRows(src, i + 1);
  if (header.includes('Где употребляется')) {
    for (const r of rows) homeless.push(r[0]);
    continue;
  }
  if (!header.includes('Синонимы')) {
    fatal = `неизвестная таблица терминов в строке ${i + 1}: ${header}`;
    break;
  }
  for (const r of rows) {
    terms.push(r[0]);
    for (const syn of (r[2] || '').split(';')) {
      if (!syn.includes('к вытеснению')) continue;
      const name = syn.split('`')[0].trim();
      if (name) oust.push(name);
    }
  }
}

if (!fatal && terms.length === 0) fatal = 'в словаре не нашлось ни одной таблицы терминов';

if (fatal) {
  console.log(`  ${SOURCE}: ${fatal}`);
  console.log('\nформа словаря изменилась - править генератор, а не обходить его');
  process.exit(1);
}

const body = `# Термины каталога: заведённые имена

Генерируется из \`docs/domain/domain-model.md\` (\`node tools/sync-terminology.js\`), руками не
правится. Здесь только перечень имён; значение, дом термина и «не путать с» - в словаре.
Frontmatter \`paths\` у файла нет намеренно: правило грузится каждую сессию и входит в стартовый
контекст субагентов, тогда как path-scoped сработало бы уже после выбора имени.

Имя сущности корпуса берётся отсюда. Термина в перечне нет - строка заводится в словаре **тем же
изменением**, что вводит имя, и индекс перегенерируется.

**Заведённые имена** (${terms.length}): ${terms.join(', ')}.

**Имена \`к вытеснению\`** - в новом тексте дефект, не стилистика: ${oust.join(', ')}.

**В обиходе, дома нет** (термин законен, нормативного определения нет - словарь, «Термины без
дома»): ${homeless.join(', ')}.
`;

const current = (() => {
  try {
    return readFileSync(TARGET, 'utf8');
  } catch {
    return null;
  }
})();

if (current === body) {
  console.log(`синхронно: ${terms.length} имён, ${oust.length} к вытеснению, ${homeless.length} без дома`);
  process.exit(0);
}

if (checkOnly) {
  console.log(`  ${TARGET} разошёлся со словарём`);
  console.log('\nвыполни `npm run sync:terminology`');
  process.exit(1);
}

writeFileSync(TARGET, body);
console.log(
  `записано в .claude/rules/terminology.md: ${terms.length} имён, ${oust.length} к вытеснению, ${homeless.length} без дома`
);
