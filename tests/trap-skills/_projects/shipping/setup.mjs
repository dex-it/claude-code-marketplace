#!/usr/bin/env node
// Сборка репозитория shipping из history/NNN-*/ по порядку имён каталогов. Шаг - один из op:
//   commit  на ветку `branch`: files/ (полное содержимое, новые и заменённые файлы), EDITS (правки
//           «найти - заменить», найденный текст обязан встретиться ровно один раз), DELETE (пути);
//   branch  ветка `branch` от `from`;
//   merge   в `branch` ветки `source`, всегда --no-ff, сообщение - из META;
//   tag     аннотированный тег `tag` на голове `branch`.
// META: строки `ключ: значение`, пустая строка, сообщение коммита/мерджа/тега. `ref: A, B` - после
// шага HEAD записывается в refs/cases/A и refs/cases/B (имена для кейсов и ключа, refs.json).
// Использование: node setup.mjs <dest> [ref] [--write-refs]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HISTORY = join(HERE, 'history');
const REFS_FILE = join(HERE, 'refs.json');
const args = process.argv.slice(2);
const writeRefs = args.includes('--write-refs');
const [destArg, checkout = 'develop'] = args.filter((a) => a !== '--write-refs');
if (!destArg) { console.error('usage: setup.mjs <dest> [ref] [--write-refs]'); process.exit(2); }
if (existsSync(destArg)) { console.error(`exists: ${destArg}`); process.exit(1); }
mkdirSync(destArg, { recursive: true });
const dest = execFileSync('pwd', { cwd: destArg, encoding: 'utf8' }).trim();

const PEOPLE = {
  anna: ['Anna Sokolova', 'anna@shipping.example'],
  dmitry: ['Dmitry Volkov', 'dmitry@shipping.example'],
  oleg: ['Oleg Petrov', 'oleg@shipping.example'],
  pavel: ['Pavel Orlov', 'pavel@shipping.example'],
};
// Чужой глобальный конфиг (подпись коммитов, autocrlf, шаблоны) не должен менять SHA.
const BASE_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', TZ: 'UTC', LC_ALL: 'C' };
const git = (args, env = {}) => execFileSync('git', args, { cwd: dest, env: { ...BASE_ENV, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function readMeta(file) {
  const text = readFileSync(file, 'utf8');
  const cut = text.indexOf('\n\n');
  const head = cut < 0 ? text : text.slice(0, cut);
  const meta = {};
  for (const line of head.split('\n')) { const m = /^([\w-]+):\s*(.*)$/.exec(line); if (m) meta[m[1]] = m[2].trim(); }
  meta.message = cut < 0 ? '' : text.slice(cut + 2).trimEnd() + '\n';
  return meta;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p)); else out.push(p);
  }
  return out;
}

// EDITS: блоки
//   <<<<<<< путь
//   старый текст
//   =======
//   новый текст
//   >>>>>>>
function applyEdits(step, file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const h = /^<<<<<<< (.+)$/.exec(lines[i]);
    if (!h) { if (lines[i].trim()) throw new Error(`${step}: EDITS:${i + 1}: строка вне блока`); continue; }
    const mid = lines.indexOf('=======', i + 1), end = lines.indexOf('>>>>>>>', mid + 1);
    if (mid < 0 || end < 0) throw new Error(`${step}: EDITS:${i + 1}: блок не закрыт`);
    const oldText = lines.slice(i + 1, mid).join('\n'), newText = lines.slice(mid + 1, end).join('\n');
    const target = join(dest, h[1]);
    const cur = readFileSync(target, 'utf8');
    const at = cur.indexOf(oldText);
    if (!oldText || at < 0 || cur.indexOf(oldText, at + 1) >= 0) throw new Error(`${step}: EDITS:${i + 1}: текст для ${h[1]} не найден ровно один раз`);
    writeFileSync(target, cur.slice(0, at) + newText + cur.slice(at + oldText.length));
    i = end;
  }
}

git(['init', '-q', '-b', 'main']);
const hasHead = () => { try { git(['rev-parse', '--verify', '-q', 'HEAD']); return true; } catch { return false; } };
// Сообщение - через файл в .git: `git merge` не читает -F из stdin.
const msgFile = (meta) => { const f = join(dest, '.git', 'SETUP_MSG'); writeFileSync(f, meta.message); return f; };
const refs = {};
for (const step of readdirSync(HISTORY).filter((d) => /^\d{3}-/.test(d)).sort()) {
  const dir = join(HISTORY, step);
  const meta = readMeta(join(dir, 'META'));
  const [name, email] = PEOPLE[meta.author ?? 'oleg'] ?? (() => { throw new Error(`${step}: автор ${meta.author}`); })();
  const env = { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_DATE: meta.date, GIT_COMMITTER_DATE: meta.date };
  const onBranch = (b) => { if (git(['symbolic-ref', '--short', 'HEAD']) !== b) git(['checkout', '-q', b]); };
  switch (meta.op) {
    case 'commit': {
      if (hasHead()) onBranch(meta.branch);
      if (existsSync(join(dir, 'files'))) for (const f of walk(join(dir, 'files'))) {
        const rel = relative(join(dir, 'files'), f), to = join(dest, rel);
        mkdirSync(dirname(to), { recursive: true });
        writeFileSync(to, readFileSync(f));
      }
      if (existsSync(join(dir, 'EDITS'))) applyEdits(step, join(dir, 'EDITS'));
      if (existsSync(join(dir, 'DELETE'))) for (const p of readFileSync(join(dir, 'DELETE'), 'utf8').split('\n').filter(Boolean)) rmSync(join(dest, p));
      git(['add', '-A']);
      git(['commit', '-q', '-F', msgFile(meta)], env);
      break;
    }
    case 'branch':
      git(['checkout', '-q', '-b', meta.branch, meta.from]);
      break;
    case 'merge':
      onBranch(meta.branch);
      git(['merge', '-q', '--no-ff', '-F', msgFile(meta), meta.source], env);
      break;
    case 'tag':
      git(['tag', '-a', meta.tag, '-F', msgFile(meta), meta.branch], env);
      break;
    default:
      throw new Error(`${step}: op ${meta.op}`);
  }
  for (const r of (meta.ref ?? '').split(/[\s,]+/).filter(Boolean)) {
    refs[r] = git(['rev-parse', 'HEAD']);
    git(['update-ref', `refs/cases/${r}`, refs[r]]);
  }
}
rmSync(join(dest, '.git', 'SETUP_MSG'), { force: true });
git(['checkout', '-q', checkout]);

if (writeRefs) {
  writeFileSync(REFS_FILE, JSON.stringify(refs, null, 2) + '\n');
  console.log(`refs.json: ${Object.keys(refs).length} refs`);
} else if (existsSync(REFS_FILE)) {
  const want = JSON.parse(readFileSync(REFS_FILE, 'utf8'));
  const bad = [...new Set([...Object.keys(want), ...Object.keys(refs)])].filter((k) => want[k] !== refs[k]);
  if (bad.length) {
    for (const k of bad) console.error(`refs.json mismatch ${k}: want ${want[k]} got ${refs[k]}`);
    process.exit(1);
  }
}
