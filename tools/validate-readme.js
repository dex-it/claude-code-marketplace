#!/usr/bin/env node
/**
 * README validator for Claude Code marketplace.
 *
 * Витрина `README.md` против витрины каталога `marketplace.json`: назван ли
 * каждый плагин, не ведёт ли строка таблицы на мёртвое имя, совпадает ли
 * версия каталога в подвале.
 *
 * Зачем: `README.md` - второй носитель состава каталога, и генератора у него
 * нет, он правится руками. Замер 01.09.2026 этим же инструментом на базе PR
 * (`b846fd6f`) показал цену: 85 плагинов из 245 не были названы ни одной из
 * двух форм. Расхождение молчаливое - `sync-marketplace.js --check` судит
 * только пару `plugin.json` x `marketplace.json` и README не видит. До этой
 * правки инструмент жил вне общего гейта (`check-readme-coverage.js`, без
 * маски `validate-*.js`) - зелёный прогон на живом каталоге доказывал
 * отсутствие предмета, а не работоспособность самих проверок.
 *
 * Правила:
 *   readme-plugin-unnamed  - плагин витрины не назван в README ни полным
 *                            именем, ни коротким в позиции имени плагина.
 *   readme-row-ghost       - ячейка таблицы README ссылается на имя,
 *                            которого нет в витрине.
 *   readme-version-drift   - версия в подвале README не равна версии
 *                            витрины (включая случай «строка подвала не
 *                            найдена»).
 *
 * Обе стороны сверки читают один перечень имён - тот, что README ставит в
 * позицию имени плагина, и берут его из текста без код-блоков: строка
 * `| dex-... |` внутри примера показывает форму записи, а не называет плагин.
 * Позиций три, и в каждой имя читается по своему
 * правилу, заданному шапкой таблицы: первая ячейка строки таблицы `Bundle` -
 * короткая форма бандла (`architect` -> `dex-bundle-architect`), первая
 * ячейка прочих витрин - полное имя, code-span в таблице с колонкой `Skills`
 * - короткая форма скилла (`ddd` -> `dex-skill-ddd`). Проза и прочие колонки
 * в предмет не входят: там то же слово называет агента, команду или внешний
 * бинарь - `architect` во второй колонке строки `| dex-architect | architect |`
 * есть имя агента, а code-span третьей колонки таблицы CLI-инструментов -
 * имя бинаря (`gh`, `psql`), и сверка любого code-span подряд дала бы 14
 * ложных имён из 170 (замер 01.09.2026).
 *
 * Шапка таблицы здесь несёт нагрузку, а не оформление: короткая форма не
 * инъективна - `architect` делят специалист `dex-architect` и бандл
 * `dex-bundle-architect`, `sdlc` - движок `dex-sdlc` и бандл
 * `dex-bundle-sdlc`. Сверка «слово где-нибудь в README» на этом ложно
 * зеленеет: снятая строка бандла закрывалась именем агента из чужой строки
 * (проверено фальсификацией на живом README). Позиция снимает
 * неоднозначность без правки витрины - короткое имя там и означает бандл,
 * а требование полной формы в этой колонке сломало бы её смысл: колонка
 * `Bundle` несёт аргумент установщика (`install-bundle.sh architect`).
 *
 * Таблица `Skills` называет скилл, а не плагин, и обычно плагин зовётся
 * `dex-skill-<скилл>`. Где это не так (движок `dex-sdlc` везёт скилл `engine`),
 * имя резолвится через владельца скилла, и владельцы читаются с дерева при
 * каждом прогоне - список исключений в коде протухал бы молча.
 *
 * Чего НЕ судится: содержание строки. Устаревшее описание правило не ловит -
 * его ловит ревью. Предмет здесь один: состав, а не текст.
 *
 * Usage:
 *   node tools/validate-readme.js all
 *
 * Exit codes:
 *   0 - clean
 *   1 - at least one error found
 *   2 - marketplace.json or README.md could not be read (tool failure, not a rule finding)
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js
// прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};
const ERROR = 'error';

const MARKETPLACE_JSON = join(REPO_ROOT, '.claude-plugin', 'marketplace.json');
const README_MD = join(REPO_ROOT, 'README.md');

let catalog;
let readme;
try {
  catalog = JSON.parse(readFileSync(MARKETPLACE_JSON, 'utf8'));
  readme = readFileSync(README_MD, 'utf8');
} catch (e) {
  console.error(`Не прочитано: ${e.message}`);
  process.exit(2);
}
const plugins = catalog.plugins;
if (!Array.isArray(plugins)) {
  console.error('В marketplace.json нет массива `plugins` - витрину не с чем сверять');
  process.exit(2);
}

const shortNameOf = (name) => name.replace(/^dex-(bundle-|skill-)?/, '');

const named = new Set(plugins.map((p) => p.name));

// Короткая форма не инъективна: shortNameOf схлопывает специалиста и бандл
// с общей темой в одну строку (`dex-architect` / `dex-bundle-architect` ->
// "architect"). Группировка живая - из витрины на лету, не список в коде,
// иначе перечень коллизий протухнет молча при следующем плагине.
const byShortName = new Map(); // short -> [full names]
for (const p of plugins) {
  const short = shortNameOf(p.name);
  if (!byShortName.has(short)) byShortName.set(short, []);
  byShortName.get(short).push(p.name);
}

// Таблица `Skills` называет СКИЛЛ, а не плагин, и README объявляет их связь
// прозой перед таблицей: «Имя плагина - `dex-skill-<имя скилла>`, единственное
// исключение - движок `dex-sdlc:engine`». Владельцы читаются с дерева, а не
// списком в коде: список исключений протухает молча, а дерево - тот же
// источник, по которому README и заполняется. Ключ - имя скилла, значение -
// плагин, который его везёт.
const skillOwners = new Map();
for (const p of plugins) {
  if (typeof p.source !== 'string') continue;
  const skillsDir = join(REPO_ROOT, p.source, 'skills');
  if (!existsSync(skillsDir)) continue;
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!existsSync(join(skillsDir, entry.name, 'SKILL.md'))) continue;
    if (!skillOwners.has(entry.name)) skillOwners.set(entry.name, p.name);
  }
}

// Позиции, в которых README называет плагин, и правило разрешения имени в
// каждой. Обе стороны сверки - прямая и обратная - читают один перечень:
// разойдись они, плагин считался бы названным там, где имя принадлежит
// агенту, команде или внешнему бинарю.
//   - первая ячейка строки таблицы, с backticks или без. Как читать имя,
//     задаёт шапка таблицы: `| Bundle |` - короткая форма бандла
//     (`architect` -> `dex-bundle-architect`), прочие витрины - полное имя.
//     Заголовок и строка-разделитель не матчатся: первый символ обязан быть
//     `[a-z0-9]`, а заголовки витрины - на кириллице либо с заглавной
//     латиницы, разделитель - тире;
//   - код-спаны в таблице с колонкой `Skills`: перечень скиллов категории
//     через запятую в одной ячейке, короткая форма скилла (`ddd` ->
//     `dex-skill-ddd`); первая ячейка там - имя категории, не плагина.
// Шапка снимает неоднозначность короткой формы: `architect` делят специалист
// `dex-architect` и бандл `dex-bundle-architect`, но в таблице бандлов это
// имя бандла, а слово `architect` во второй колонке строки
// `| dex-architect | architect | ... |` - имя агента, и покрытия не даёт
// никому. Прочие колонки в предмет не входят по той же причине: в таблицах
// CLI-инструментов код-спан третьей колонки - имя внешнего бинаря (`gh`,
// `psql`), и включение их дало бы 14 ложных имён из 170 (замер 01.09.2026).
function collectNamed(text) {
  const found = new Set();
  const lines = text.split('\n');
  const isSeparatorRow = (s) => /^\|[\s:|-]+$/.test(s);
  let prefix = '';
  let inSkillsTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) {
      prefix = '';
      inSkillsTable = false;
      continue;
    }
    if (isSeparatorRow(line)) continue;
    if (isSeparatorRow((lines[i + 1] || '').trim())) {
      inSkillsTable = /\|\s*Skills\s*\|/.test(line);
      // Шапка сверяется дословно, как она стоит в витрине: регистронезависимый
      // матч у одной шапки и точный у другой дали бы две разные строгости на одном
      // и том же механизме.
      prefix = /\|\s*Bundle\s*\|/.test(line) ? 'dex-bundle-' : '';
      continue;
    }
    if (inSkillsTable) {
      for (const m of line.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)) found.add(`dex-skill-${m[1]}`);
      continue;
    }
    const cell = /^\|\s*`?([a-z0-9][a-z0-9-]*)`?\s*\|/.exec(line);
    if (cell != null) found.add(`${prefix}${cell[1]}`);
  }
  return found;
}

// Пример таблицы внутри код-блока - не витрина: строка `| dex-... |` там
// показывает форму записи, а не называет плагин. Читать её нельзя в обе
// стороны сразу: покрытие закрылось бы образцом, а имя-заглушка приехало бы
// мёртвой ссылкой. Тот же приём и по той же причине - в `validate-agent.js`
// (сигнатура handoff внутри примера свидетелем не считается).
const FENCED_BLOCK_RE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;
const withoutFences = (text) => text.replace(FENCED_BLOCK_RE, '');

// Имена, которыми README называет плагины, уже приведённые к полной форме.
const mentioned = collectNamed(withoutFences(readme));

const findings = [];

// readme-plugin-unnamed: каждый плагин витрины назван в README хотя бы одной
// из двух форм - полным именем (`dex-architect`) либо каноничным коротким
// (`architect` для бандла, `ddd` для скилла). Неоднозначность короткой формы
// снимает позиция, а не соседи: `collectNamed` уже привела имя к полной форме
// по шапке таблицы, в которой оно стоит, поэтому здесь остаётся членство в
// перечне. `collidesWith` считается только ради текста сообщения - оно
// называет, где искать вторую претендентку на то же короткое имя.
for (const p of plugins) {
  const short = shortNameOf(p.name);
  const collidesWith = byShortName.get(short).filter((n) => n !== p.name);
  if (mentioned.has(p.name)) continue;
  findings.push({
    level: ERROR,
    rule: 'readme-plugin-unnamed',
    message:
      collidesWith.length > 0
        ? `плагин витрины "${p.name}" не назван в README: в позиции имени плагина его нет. Короткая форма "${short}" делит имя с ${collidesWith.join(', ')}, и кому она принадлежит, решает шапка таблицы, в которой стоит`
        : `плагин витрины "${p.name}" не назван в README ни полным именем, ни коротким ("${short}") в позиции имени плагина`,
  });
}

// readme-row-ghost: обратная сторона - ссылка README резолвится в реальный
// плагин каталога, полным или коротким именем.
function resolves(name) {
  if (named.has(name)) return true;
  // Имя из таблицы `Skills` приведено к форме `dex-skill-<скилл>`; плагина с
  // таким именем может не быть, но скилл в каталоге есть и его кто-то везёт.
  const short = name.startsWith('dex-skill-') ? name.slice('dex-skill-'.length) : null;
  return short != null && skillOwners.has(short);
}

const ghosts = new Set([...mentioned].filter((n) => !resolves(n)));

for (const n of ghosts) {
  findings.push({
    level: ERROR,
    rule: 'readme-row-ghost',
    message: `ссылка в таблице README ведёт на имя "${n}", которого нет в витрине каталога`,
  });
}

// readme-version-drift: версия в подвале README (третий носитель версии
// каталога) равна версии витрины. Сверяется ровно строка подвала, а не любое
// вхождение номера в текст.
const footer = /\*\*DEX Team\*\*[^\n]*?Version\s+(\d+\.\d+\.\d+)/.exec(readme);
// Пропавшая строка подвала и разошедшийся номер - один исход, поэтому и одна
// ветка: развилка дала бы правилу второй текст, которому свидетеля не построить
// (подвал либо есть, либо нет, и в одном прогоне обе стороны не наблюдаются).
const footerVersion = footer == null ? 'строка подвала не найдена' : footer[1];
if (footerVersion !== catalog.version) {
  findings.push({
    level: ERROR,
    rule: 'readme-version-drift',
    message: `версия каталога в подвале README («**DEX Team** ... Version X.Y.Z») - ${footerVersion}, в витрине - ${catalog.version}`,
  });
}

// --- Reporting ------------------------------------------------------------

function formatFinding(f) {
  return `  ${COLORS.red}ERROR${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} ${f.message}`;
}

function report() {
  if (findings.length > 0) {
    console.log(`\n${COLORS.bold}${relative(REPO_ROOT, README_MD)}${COLORS.reset}`);
    for (const f of findings) console.log(formatFinding(f));
  }
  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${plugins.length} plugin(s) checked, ` +
      `${COLORS.red}${findings.length} error(s)${COLORS.reset}`
  );
  return findings.length > 0 ? 1 : 0;
}

process.exit(report());
