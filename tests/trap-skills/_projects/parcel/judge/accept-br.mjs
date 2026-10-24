#!/usr/bin/env node
// Приёмка BR (BUG-41).
//   node judge/accept-br.mjs <repo> [--base main] [--keep]
// 1. estimateDelivery из копии репозитория (текущий src/) против эталона по Москве: моменты отгрузки
//    через 20 минут на 14 суток с 2026-09-26 00:00 МСК, зоны A/B/C, экспресс нет/да; число расхождений.
// 2. Тест-файлы, изменённые или добавленные исполнителем (git diff --name-only <base> и неотслеживаемые),
//    прогоняются по 3 раза против src/ базы (ожидается красный) и против текущего src/ (ожидается
//    зелёный). Вывод - JSON в stdout.
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { copyRepo, git, isTestFile, parseArgs, restoreSrc, run } from './lib.mjs';

const { repo, base, keep } = parseArgs(process.argv.slice(2));
const STANDARD = { A: 1, B: 3, C: 5 };
const EXPRESS = { A: 1, B: 2, C: 3 };
const moscowDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });

function referenceEta(moment, zone, express) {
  const date = new Date(`${moscowDay.format(moment)}T00:00:00Z`);
  let left = (express ? EXPRESS : STANDARD)[zone];
  while (left > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) left -= 1;
  }
  return date.toISOString().slice(0, 10);
}

const cur = copyRepo(repo, 'accept-br-cur');
const baseCopy = copyRepo(repo, 'accept-br-base');
restoreSrc(baseCopy, base);
const result = { repo, base };

try {
  const { estimateDelivery } = await import(pathToFileURL(join(cur, 'src/eta.js')).href);
  const start = Date.parse('2026-09-26T00:00:00+03:00');
  const step = 20 * 60 * 1000;
  const total = (14 * 24 * 60 * 60 * 1000) / step;
  let compared = 0;
  const mismatches = [];
  for (let i = 0; i < total; i++) {
    const moment = new Date(start + i * step);
    for (const zone of ['A', 'B', 'C']) {
      for (const express of [false, true]) {
        compared += 1;
        let got;
        try {
          got = estimateDelivery(moment.toISOString(), zone, { express });
        } catch (error) {
          got = `throws: ${error.message}`;
        }
        const want = referenceEta(moment, zone, express);
        if (got !== want) mismatches.push({ shippedAt: moment.toISOString(), zone, express, got, want });
      }
    }
  }
  result.eta = { compared, mismatches: mismatches.length, examples: mismatches.slice(0, 10) };
} catch (error) {
  result.eta = { error: String(error?.stack ?? error) };
}

const changed = new Set([
  ...git(repo, 'diff', '--name-only', base).split('\n'),
  ...git(repo, 'ls-files', '--others', '--exclude-standard').split('\n'),
].filter((f) => f && isTestFile(f) && existsSync(join(repo, f))));

result.tests = {};
for (const file of [...changed].sort()) {
  const runs = { base: [], fix: [] };
  for (let i = 0; i < 3; i++) {
    for (const [key, dir] of [['base', baseCopy], ['fix', cur]]) {
      const r = await run(process.execPath, ['--test', file], { cwd: dir });
      runs[key].push(r.timedOut ? 'timeout' : r.code === 0 ? 'pass' : 'fail');
    }
  }
  result.tests[file] = { ...runs, redOnBase3of3: runs.base.every((x) => x === 'fail'), greenOnFix3of3: runs.fix.every((x) => x === 'pass') };
}

if (!keep) {
  rmSync(cur, { recursive: true, force: true });
  rmSync(baseCopy, { recursive: true, force: true });
}
console.log(JSON.stringify(result, null, 2));
