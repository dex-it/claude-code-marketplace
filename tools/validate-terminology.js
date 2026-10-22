#!/usr/bin/env node
// Имена `к вытеснению` в текстах каталога; норма и границы области - docs/VALIDATOR_RULES.md.

import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// MARKETPLACE_ROOT переносит валидатор на дерево-песочницу: tools/test-rules.js прогоняет правило на фикстуре, а не на живом каталоге.
const REPO_ROOT = process.env.MARKETPLACE_ROOT
  ? resolve(process.env.MARKETPLACE_ROOT)
  : resolve(__dirname, '..');

const COLORS = { reset: '\x1b[0m', red: '\x1b[31m', yellow: '\x1b[33m', gray: '\x1b[90m', bold: '\x1b[1m' };

// Уровень правила. Норма (CLAUDE.md, «Имя сущности корпуса берётся из словаря») называет имя `к вытеснению` дефектом;
// warning держится, пока на дереве есть вхождение, которое нельзя снять мелкой правкой (см. VALIDATOR_RULES.md).
const LEVEL = 'warning';

// Закрытый перечень - блок «Имена `к вытеснению`» сгенерированного индекса, а не второй список в коде: индекс
// строится из словаря, и его синхронность с ним держит `sync-terminology.js --check`.
const INDEX_FILE = join(REPO_ROOT, '.claude', 'rules', 'terminology.md');
const INDEX_MARKER = '**Имена `к вытеснению`**';

// Область: тексты каталога. Вне её - записи, где старое имя стоит на своём месте: словарь и индекс (имя там предмет
// определения), планы и ADR (снимок решения), записи замеров (имя, как оно называлось на момент замера; переписать
// значит подделать запись), research (слово «раунд» там - раунд эксперимента, не ревизия).
const ROOTS = ['plugins', 'docs'];
const SKIP_DIRS = ['docs/superpowers', 'docs/adr', 'docs/research', 'plugins/auto/docs/notes'];
const SKIP_FILES = ['docs/domain/domain-model.md'];

// Обход не проходит по symlink и спецфайлам: цикл ссылок ронял бы прогон стектрейсом, а ссылка наружу судила бы
// чужой файл как свой. Такой узел - отказ с кодом 1, а не тихий пропуск.
function statPlain(full) {
  const stat = lstatSync(full);
  if (stat.isSymbolicLink() || !(stat.isFile() || stat.isDirectory())) {
    console.error(`Not a regular file or directory (symlinks and special files are not followed): ${relative(REPO_ROOT, full)}`);
    process.exit(1);
  }
  return stat;
}

// Путь и имя приходят из файлов под суд: управляющие символы переписали бы терминал, `##[` стал бы командой раннера Actions.
function show(value) {
  return String(value)
    .replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
    .replace(/##\[/g, '#\\u0023[')
    .replace(/::/g, ':\\u003a');
}

function fail(message) {
  console.error(show(message));
  process.exit(1);
}

function loadOustedNames() {
  if (!existsSync(INDEX_FILE)) fail(`${relative(REPO_ROOT, INDEX_FILE)} not found - run \`npm run sync:terminology\``);
  const line = readFileSync(INDEX_FILE, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(INDEX_MARKER));
  const colon = line ? line.lastIndexOf(': ') : -1;
  const names = colon < 0 ? [] : line.slice(colon + 2).replace(/\.\s*$/, '').split(', ').map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) fail(`${relative(REPO_ROOT, INDEX_FILE)}: no names under "${INDEX_MARKER}" - the index format changed, fix the reader instead of bypassing it`);
  return names;
}

// Имя матчится фразой целиком. Расширение до слова давало 10 ложных из 10 («круг» -> «возврат по кругу»), поэтому
// допуск один: падежное окончание. Кириллическое слово теряет последнюю гласную и берёт до трёх букв (`круг` -> `круга`,
// `рекомендация` -> `рекомендации`, `владелец` -> `владельца`); латинское берёт апостроф и до трёх букв (`skill'ы`).
// Границы: перед именем не буква и не дефис (`skill этапа` не срабатывает внутри `process-skill этапа`), после - не
// буква и не дефис-буква (`раунд-трип`). Пробел между словами - любой, включая перевод строки и `>` цитаты: замена,
// пересёкшая перевод строки, и была тем, что ручной проход пропустил («за два\nревизии»).
function wordPattern(word) {
  const tail = '\\p{L}{0,3}';
  if (/^[\p{Script=Cyrillic}]+$/u.test(word)) {
    const stem = word.replace(/[аяыиоеуюьй]$/u, '');
    return (stem.endsWith('ец') ? `${stem.slice(0, -2)}(?:ец|ьц)` : stem) + tail;
  }
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `['’]?${tail}`;
}

function buildMatcher(name) {
  const body = name.split(/\s+/).map(wordPattern).join('[\\s>]+');
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${body}(?![\\p{L}\\p{N}_]|-\\p{L})`, 'giu');
}

// Frontmatter скилла и агента из-под правила выведен: там живут активаторы, и синоним в них законен как ключ поиска
// (ось «Терминология» в `artifact-review`). Затирается пробелами, номера строк остаются прежними.
function blankFrontmatter(text) {
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  return m ? m[0].replace(/[^\n]/g, ' ') + text.slice(m[0].length) : text;
}

function lineLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

function findFiles() {
  const files = [];
  const rel = (full) => relative(REPO_ROOT, full).split(sep).join('/');
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      const full = join(dir, entry);
      const path = rel(full);
      if (statPlain(full).isDirectory()) {
        if (!SKIP_DIRS.includes(path)) walk(full);
      } else if (path.endsWith('.md') && !SKIP_FILES.includes(path)) {
        files.push(full);
      }
    }
  }
  for (const root of ROOTS) walk(join(REPO_ROOT, root));
  return files;
}

function validateFile(filepath, matchers) {
  const text = blankFrontmatter(readFileSync(filepath, 'utf8'));
  const lineAt = lineLocator(text);
  const findings = [];
  for (const { name, re } of matchers) {
    for (const m of text.matchAll(re)) {
      findings.push({
        rule: 'ousted-name',
        line: lineAt(m.index),
        message: `name "${name}" is marked \`к вытеснению\` in the dictionary (found "${m[0].replace(/\s+/g, ' ')}") - use the main name of the row in docs/domain/domain-model.md that lists it among synonyms`,
      });
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && args[0] !== 'all')) fail('Usage: node tools/validate-terminology.js [all]');
  if (process.env.MARKETPLACE_ROOT === '') fail('MARKETPLACE_ROOT is set but empty - unset it or point it at a marketplace tree');

  const names = loadOustedNames();
  const matchers = names.map((name) => ({ name, re: buildMatcher(name) }));
  const files = findFiles();

  let errors = 0;
  let warnings = 0;
  for (const filepath of files) {
    const findings = validateFile(filepath, matchers);
    if (findings.length === 0) continue;
    console.log(`\n${COLORS.bold}${show(relative(REPO_ROOT, filepath))}${COLORS.reset}`);
    for (const f of findings) {
      const label = LEVEL === 'warning' ? `${COLORS.yellow}WARN ` : `${COLORS.red}ERROR`;
      console.log(`  ${label}${COLORS.reset} ${COLORS.gray}[${f.rule}]${COLORS.reset} line ${f.line}: ${show(f.message)}`);
      if (LEVEL === 'warning') warnings += 1;
      else errors += 1;
    }
  }

  console.log('');
  console.log(
    `${COLORS.bold}Summary:${COLORS.reset} ${files.length} file(s) checked against ${names.length} name(s), ` +
      `${COLORS.red}${errors} error(s)${COLORS.reset}, ${COLORS.yellow}${warnings} warning(s)${COLORS.reset}`
  );
  process.exit(errors > 0 ? 1 : 0);
}

main();
