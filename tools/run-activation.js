#!/usr/bin/env node
/**
 * Прогон активации скиллов: срабатывает ли `description` на реалистичном запросе.
 *
 * Зачем: `description` скилла - поле срабатывания, и его правка меняет, поймается
 * ли скилл вообще. Валидатор судит форму поля (длина, наличие), а не факт
 * активации; `npm test` судит валидаторы. Активацию решает модель, читая поле, -
 * проверяется только запуском.
 *
 * Метод: headless-сессия `claude -p` в пустой директории (CLAUDE.md проекта не
 * подсказывает), стрим событий, из него - имена, с которыми вызван Skill.
 * Кейс `in-scope` ждёт свой скилл среди вызванных, `near-miss` ждёт его отсутствия:
 * поле, ловящее всё подряд, дефект той же природы, что и не ловящее ничего.
 *
 * Прогон стоит денег и ходит в сеть, поэтому НЕ входит в `npm test` и в CI.
 *
 * Модель - ось результата, не деталь запуска: зонд 23.08.2026 на одном кейсе дал
 * opus - скилл + смежный, sonnet - скилл, haiku - ни одного вызова. Модель прогона
 * пишется в отчёт, сравнивать прогоны на разных моделях нельзя.
 *
 * Usage:
 *   node tools/run-activation.js                       # все кейсы, sonnet, 1 прогон
 *   node tools/run-activation.js --model opus --runs 3
 *   node tools/run-activation.js --case redis          # подстрока id кейса
 *   node tools/run-activation.js --json out.json
 *
 * Exit codes:
 *   0 - все кейсы прошли
 *   1 - хотя бы один провалился
 *   2 - ошибка запуска (нет кейсов, нет claude в PATH)
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CASES_FILE = join(REPO_ROOT, 'tests', 'activation', 'cases.json');

const COLORS = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', gray: '\x1b[90m', bold: '\x1b[1m' };
const c = (color, s) => `${COLORS[color]}${s}${COLORS.reset}`;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const MODEL = arg('model', 'sonnet');
const RUNS = Number(arg('runs', '1'));
const FILTER = arg('case', null);
const CONCURRENCY = Number(arg('concurrency', '4'));
const JSON_OUT = arg('json', null);
const TIMEOUT_MS = Number(arg('timeout', '300')) * 1000;

// Инструменты действия в прогоне активации не нужны и стоят денег: предмет пробы -
// какой Skill выбран, а не что агент сделает дальше.
const DISALLOWED = 'Bash,Write,Edit,WebFetch,WebSearch,Agent,Task';

function runCase(kase) {
  return new Promise((resolvePromise) => {
    const sandbox = mkdtempSync(join(tmpdir(), 'activation-'));
    const args = [
      '-p', kase.prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--max-turns', '2',
      '--model', MODEL,
      '--disallowed-tools', DISALLOWED,
    ];
    const child = spawn('claude', args, { cwd: sandbox, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let killed = false;
    const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', () => { clearTimeout(timer); rmSync(sandbox, { recursive: true, force: true }); resolvePromise({ error: 'claude не запустился' }); });
    child.on('close', () => {
      clearTimeout(timer);
      rmSync(sandbox, { recursive: true, force: true });
      if (killed) return resolvePromise({ error: `таймаут ${TIMEOUT_MS / 1000}s` });
      const skills = [];
      let cost = 0;
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        if (e.type === 'assistant') {
          for (const part of e.message?.content ?? []) {
            if (part.type === 'tool_use' && part.name === 'Skill' && part.input?.skill) skills.push(part.input.skill);
          }
        }
        if (e.type === 'result') cost = e.total_cost_usd ?? 0;
      }
      resolvePromise({ skills, cost });
    });
  });
}

async function pool(items, worker, limit) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

// --- Main ---------------------------------------------------------------

let cases;
try {
  cases = JSON.parse(readFileSync(CASES_FILE, 'utf8'));
} catch (e) {
  console.error(`Не прочитан ${CASES_FILE}: ${e.message}`);
  process.exit(2);
}
if (FILTER) cases = cases.filter((k) => k.id.includes(FILTER));
if (cases.length === 0) {
  console.error('Кейсов под фильтр нет');
  process.exit(2);
}

const jobs = [];
for (const kase of cases) for (let r = 0; r < RUNS; r++) jobs.push({ kase, run: r });

console.log(`Прогон активации: ${cases.length} кейс(ов) x ${RUNS} = ${jobs.length} запуск(ов), модель ${MODEL}, параллельно ${CONCURRENCY}\n`);

const started = Date.now();
const outcomes = await pool(jobs, async ({ kase, run }) => {
  const res = await runCase(kase);
  const fired = res.skills ?? [];
  const hit = fired.includes(kase.expect);
  const pass = res.error ? false : kase.mode === 'near-miss' ? !hit : hit;
  const mark = res.error ? c('yellow', 'ОШИБКА') : pass ? c('green', 'ok    ') : c('red', 'ПРОВАЛ');
  const detail = res.error ? res.error : fired.length ? fired.join(', ') : 'ни одного Skill';
  console.log(`${mark} ${kase.id}${RUNS > 1 ? `#${run + 1}` : ''} [${kase.mode}] -> ${c('gray', detail)}`);
  return { id: kase.id, run, mode: kase.mode, expect: kase.expect, fired, pass, error: res.error ?? null, cost: res.cost ?? 0 };
}, CONCURRENCY);

const failed = outcomes.filter((o) => !o.pass);
const cost = outcomes.reduce((s, o) => s + o.cost, 0);
const secs = Math.round((Date.now() - started) / 1000);

console.log(`\n${COLORS.bold}Итог:${COLORS.reset} ${outcomes.length} запуск(ов), ${c('green', `${outcomes.length - failed.length} прошло`)}, ${failed.length ? c('red', `${failed.length} провал`) : '0 провалов'}, $${cost.toFixed(3)}, ${secs}s, модель ${MODEL}`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ model: MODEL, runs: RUNS, outcomes }, null, 2) + '\n');
  console.log(`JSON: ${JSON_OUT}`);
}

process.exit(failed.length ? 1 : 0);
