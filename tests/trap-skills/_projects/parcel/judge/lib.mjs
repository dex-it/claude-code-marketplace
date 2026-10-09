// Общее для оракулов: копия репозитория во временный каталог, src/ из базы, поиск и прогон тест-файлов.
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';

export const TMP_ROOT = process.env.JUDGE_TMP ?? join(homedir(), '.cache/work/group-2-4a/scratch/tmp');

export function parseArgs(argv) {
  const pos = [];
  const opts = { base: 'main', env: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') opts.base = argv[++i];
    else if (argv[i] === '--env') opts.env.push(argv[++i]);
    else if (argv[i] === '--keep') opts.keep = true;
    else pos.push(argv[i]);
  }
  if (!pos[0]) throw new Error('usage: <repo> [--base <ref>]');
  return { repo: resolve(pos[0]), ...opts };
}

export function copyRepo(repo, tag) {
  mkdirSync(TMP_ROOT, { recursive: true });
  const dir = mkdtempSync(join(TMP_ROOT, `${tag}-`));
  cpSync(repo, dir, { recursive: true, filter: (src) => !/[/\\]node_modules([/\\]|$)/.test(src) });
  return dir;
}

export function restoreSrc(dir, base) {
  rmSync(join(dir, 'src'), { recursive: true, force: true });
  execFileSync('git', ['checkout', base, '--', 'src'], { cwd: dir, stdio: 'ignore' });
}

export const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

// те же шаблоны, что у `node --test` без аргументов
const TEST_FILE = /(^|\/)(test\/.+\.[cm]?js|[^/]*[.\-_]test\.[cm]?js|test-[^/]*\.[cm]?js|test\.[cm]?js)$/;
export const isTestFile = (rel) => TEST_FILE.test(rel);

export function testFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (isTestFile(relative(dir, p))) out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out.sort();
}

export function run(cmd, args, { cwd, env = process.env, timeout = 60_000 } = {}) {
  return new Promise((done) => {
    const ch = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', timedOut = false;
    const t = setTimeout(() => { timedOut = true; ch.kill('SIGKILL'); }, timeout);
    ch.stdout.on('data', (d) => { out += d; });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('close', (code) => { clearTimeout(t); done({ code, out, err, timedOut }); });
  });
}

export async function pool(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}

const unescapeTap = (s) => s.replace(/\\(.)/g, '$1');

// TAP node:test -> [{ name: 'файл > describe > тест', ok, skip }], только тесты (не suite)
export function parseTap(text, file) {
  const stack = [];
  const entries = [];
  let last = null;
  for (const line of text.split('\n')) {
    let m;
    if ((m = line.match(/^( *)# Subtest: (.*)$/))) {
      const lvl = Math.floor(m[1].length / 4);
      stack.length = lvl;
      stack[lvl] = unescapeTap(m[2]);
      continue;
    }
    if ((m = line.match(/^( *)(ok|not ok) \d+ - (.*?)( # (SKIP|TODO)\b.*)?$/))) {
      const lvl = Math.floor(m[1].length / 4);
      last = { name: [file, ...stack.slice(0, lvl), unescapeTap(m[3])].join(' > '), ok: m[2] === 'ok', skip: Boolean(m[4]), type: 'test' };
      entries.push(last);
      continue;
    }
    if (last && (m = line.match(/^ +type: '(\w+)'/))) last.type = m[1];
  }
  return entries.filter((e) => e.type !== 'suite');
}

export async function runTestFile(dir, file) {
  const r = await run(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: dir });
  const entries = parseTap(r.out, file);
  if (r.timedOut) entries.push({ name: `${file} > (таймаут 60 с)`, ok: false });
  else if (r.code !== 0 && !entries.some((e) => !e.ok)) entries.push({ name: `${file} > (файл не загрузился)`, ok: false });
  return entries;
}
