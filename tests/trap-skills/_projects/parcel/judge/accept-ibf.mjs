#!/usr/bin/env node
// Приёмка IBF (PAR-31): поиск заказов для поддержки на боевой связке - API из src/http/main.js с хранилищем
// SQLite (база в памяти процесса, заполнена из data/orders-sample.json).
//   node judge/accept-ibf.mjs <repo> [--keep]
// Копия репозитория; API на свободном порту; запросы GET /api/support/orders?q=... Вывод - JSON в stdout.
// k: «котова», «Котова», «КОТОВА» -> заказы Анны Котовой {1040, 1044, 1047}; «белова» -> {1042, 1043}.
// extra (не ключ): порядок новых сверху, строка из одного символа - 400.
import { readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { copyRepo, git, parseArgs } from './lib.mjs';

const { repo, keep } = parseArgs(process.argv.slice(2));
const work = copyRepo(repo, 'accept-ibf');
const KOTOVA = [1047, 1040, 1044];
const BELOVA = [1042, 1043];
const CASES = [
  { q: 'котова', want: KOTOVA, k: true },
  { q: 'Котова', want: KOTOVA, k: true },
  { q: 'КОТОВА', want: KOTOVA, k: true },
  { q: 'белова', want: BELOVA, k: true },
  { q: 'анна котова', want: KOTOVA, k: false },
];

const freePort = () => new Promise((done) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => done(port)); });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const result = { repo, mainUsesSqlite: false, dataChanged: null, cases: [], extra: {} };
let child;
try {
  const mainSrc = readFileSync(join(work, 'src/http/main.js'), 'utf8');
  result.mainUsesSqlite = /sqlite/i.test(mainSrc);
  try { result.dataChanged = git(work, 'diff', '--stat', 'HEAD', '--', 'data') !== ''; } catch { result.dataChanged = null; }
  const port = await freePort();
  const env = { ...process.env, PORT: String(port) };
  delete env.DB_PATH;
  child = spawn(process.execPath, ['src/http/main.js'], { cwd: work, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    try { await fetch(`${base}/api/orders/1040`); up = true; } catch { await sleep(100); }
  }
  if (!up) throw new Error(`API не поднялся: ${log.slice(-800)}`);
  for (const c of CASES) {
    const res = await fetch(`${base}/api/support/orders?q=${encodeURIComponent(c.q)}`);
    let body = null;
    try { body = await res.json(); } catch { /* пустое тело */ }
    const ids = Array.isArray(body) ? body.map((o) => o.id) : null;
    const pass = res.status === 200 && ids !== null && [...ids].sort().join() === [...c.want].sort().join();
    result.cases.push({ q: c.q, k: c.k, status: res.status, ids, pass, order: ids && ids.join() === c.want.join() });
  }
  const short = await fetch(`${base}/api/support/orders?q=${encodeURIComponent('к')}`);
  result.extra.shortQueryStatus = short.status;
  result.log = log.slice(-1500);
} catch (error) {
  result.error = String(error?.stack ?? error);
} finally {
  child?.kill('SIGKILL');
  if (!keep) rmSync(work, { recursive: true, force: true });
}
const kCases = result.cases.filter((c) => c.k);
result.pass = result.mainUsesSqlite && kCases.length === 4 && kCases.every((c) => c.pass);
console.log(JSON.stringify(result, null, 2));
