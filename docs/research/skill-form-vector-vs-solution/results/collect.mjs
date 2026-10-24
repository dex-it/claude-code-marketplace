#!/usr/bin/env node
/**
 * Сборка results.csv (строка на пару «прогон x строка ключа») и runs.csv (строка на прогон:
 * стоимость, init, вызовы). Источники:
 *   план стадии        results/plan-<stage>.csv (после оценки) или ~/.cache/research/sealed/plan-<stage>.csv
 *   оценки             results/grades/<id>.e4.json (исполнение), <id>.judge.json (судья)
 *   ручные вердикты    results/manual.csv (run_id,item_id,verdict,note) - поверх судьи
 *   прогоны            runs/<id>/meta.json
 *
 *   node results/collect.mjs [--stages A,B] [--sealed]
 * --sealed разрешает читать план из ~/.cache/research/sealed (для проверки конвейера до вскрытия).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { parseCsv, toCsv } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH = resolve(HERE, '..');
const KEYS = yaml.load(readFileSync(join(RESEARCH, 'bench/keys.yaml'), 'utf8'));
const argv = process.argv.slice(2);
const si = argv.indexOf('--stages');
const SEALED_OK = argv.includes('--sealed');
const stages = si >= 0 ? argv[si + 1].split(',') : ['A', 'B', 'C', 'D', 'H'];

const csv = toCsv;

function loadPlan(stage) {
  const open = join(HERE, `plan-${stage}.csv`);
  if (existsSync(open)) return parseCsv(readFileSync(open, 'utf8'));
  const sealed = join(homedir(), '.cache/research/sealed', `plan-${stage}.csv`);
  if (SEALED_OK && existsSync(sealed)) return parseCsv(readFileSync(sealed, 'utf8'));
  return [];
}

const manual = new Map();
if (existsSync(join(HERE, 'manual.csv'))) {
  for (const m of parseCsv(readFileSync(join(HERE, 'manual.csv'), 'utf8'))) manual.set(`${m.run_id}|${m.item_id}`, m);
}

const norm = { PASS: 'pass', FAIL: 'fail', DISPUTED: 'disputed', YES: 'yes', NO: 'no', FOUND: 'found', MISSED: 'missed' };
const itemRows = [];
const runRows = [];
for (const stage of stages) {
  for (const p of loadPlan(stage)) {
    const metaPath = join(RESEARCH, 'runs', p.id, 'meta.json');
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
    const e4 = existsSync(join(HERE, 'grades', `${p.id}.e4.json`)) ? JSON.parse(readFileSync(join(HERE, 'grades', `${p.id}.e4.json`), 'utf8')) : null;
    const judge = existsSync(join(HERE, 'grades', `${p.id}.judge.json`)) ? JSON.parse(readFileSync(join(HERE, 'grades', `${p.id}.judge.json`), 'utf8')) : null;
    const u = meta.usage ?? {};
    const plugins = (meta.init?.plugins ?? []).filter((x) => x.path !== 'builtin').map((x) => x.name);
    const skillsInit = meta.init?.skills ?? [];
    // База чистая: F0 и подача путём - ни одного скилла в init; подача плагином - только свой.
    const cleanInit = p.delivery === 'plugin' ? plugins.length <= 1 : skillsInit.length === 0 && plugins.length === 0;
    runRows.push({
      run_id: p.id, stage: p.stage, case: p.case, form: p.form, model: p.model, effort: p.effort, search: p.search, delivery: p.delivery,
      init_model: meta.init?.model, init_clean: cleanInit, init_skills: skillsInit.join('|'), init_plugins: plugins.join('|'),
      exit: meta.exitCode, result: meta.resultSubtype, turns: meta.numTurns, duration_ms: meta.durationMs,
      input_tokens: u.input_tokens, cache_write: u.cache_creation_input_tokens, cache_read: u.cache_read_input_tokens,
      output_tokens: u.output_tokens, thinking_tokens: u.output_tokens_details?.thinking_tokens, cost_usd: meta.costUsd,
      tool_calls: Object.values(meta.toolCalls ?? {}).reduce((a, b) => a + b, 0), web_calls: meta.webCalls,
      skill_calls: (meta.skillCalls ?? []).join('|'), read_skill: (meta.readPaths ?? []).some((x) => x.endsWith('/rules/SKILL.md')),
      build: e4?.build ?? '',
    });
    for (const it of KEYS[p.case].items) {
      let verdict = ''; let grader = ''; let basis = '';
      if (e4?.items?.[it.id]) { verdict = e4.items[it.id].verdict; grader = 'e4'; basis = e4.items[it.id].basis; }
      else if (judge?.items?.[it.id]) { verdict = norm[judge.items[it.id].verdict] ?? judge.items[it.id].verdict; grader = 'judge'; basis = judge.items[it.id].quote; }
      const m = manual.get(`${p.id}|${it.id}`);
      if (m) { verdict = m.verdict; grader = 'manual'; basis = m.note; }
      itemRows.push({
        run_id: p.id, stage: p.stage, case: p.case, form: p.form, model: p.model, effort: p.effort, search: p.search, delivery: p.delivery,
        item_id: it.id, kind: it.kind, unit: it.unit ?? '', class: it.class ?? '', primary: it.primary ?? '', verdict, grader, basis,
      });
    }
  }
}
writeFileSync(join(HERE, 'results.csv'), csv(itemRows, ['run_id', 'stage', 'case', 'form', 'model', 'effort', 'search', 'delivery', 'item_id', 'kind', 'unit', 'class', 'primary', 'verdict', 'grader', 'basis']));
writeFileSync(join(HERE, 'runs.csv'), csv(runRows, Object.keys(runRows[0] ?? { run_id: 1 })));
console.log(`results.csv: ${itemRows.length} строк; runs.csv: ${runRows.length} прогонов; без оценки: ${itemRows.filter((r) => !r.verdict).length}`);
