#!/usr/bin/env node
// Согласие судьи с ручной перепроверкой: node results/agree.mjs results/recheck-<stage>.csv
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './lib.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const norm = { PASS: 'pass', FAIL: 'fail', DISPUTED: 'disputed', YES: 'yes', NO: 'no', FOUND: 'found', MISSED: 'missed' };
const man = parseCsv(readFileSync(process.argv[2], 'utf8'));
let a = 0; const d = [];
for (const m of man) {
  const f = join(HERE, 'grades', `${m.run_id}.judge.json`);
  const it = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).items?.[m.item_id] : null;
  const v = it ? norm[it.verdict] : '(нет)';
  if (v === m.verdict) a++; else d.push(`${m.run_id} ${m.item_id} я=${m.verdict} судья=${v} | ${(it?.why ?? '').slice(0, 170)}`);
}
console.log(`согласие ${a}/${man.length} ${(100 * a / man.length).toFixed(1)}%`);
if (d.length) console.log(d.join('\n'));
