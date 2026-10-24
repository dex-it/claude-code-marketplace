#!/usr/bin/env node
/**
 * Сводные таблицы отчёта (README.md) из results.csv и runs.csv: тиры, лестница, вред, модификаторы
 * стадии D, стоимость. Все числа отчёта - отсюда или из tables-<стадия>.md (analyze.mjs).
 *
 *   node results/summary.mjs   ->  results/tables-summary.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, wilson, newcombe, fisher } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ITEMS = parseCsv(readFileSync(join(HERE, 'results.csv'), 'utf8')).filter((r) => r.verdict && r.stage !== 'smoke');
const RUNS = parseCsv(readFileSync(join(HERE, 'runs.csv'), 'utf8')).filter((r) => r.stage !== 'smoke');
const C_CASES = ['E4', 'L5', 'FVB', 'K1', 'CFG', 'E2'];
const B_CASES = ['E4', 'R', 'CFG', 'N0'];
const CLASSES = ['A', 'B', 'C', 'D'];

const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '-');
const kn = (k, n) => (n ? `${k}/${n} (${pct(k / n)})` : '-');
const knci = (k, n) => (n ? `${k}/${n} (${pct(k / n)}; ${pct(wilson(k, n)[0])}-${pct(wilson(k, n)[1])})` : '-');
const out = ['# Сводные таблицы', '', 'Сгенерировано results/summary.mjs из results.csv и runs.csv.'];
const h = (s) => out.push('', s, '');
const table = (cols, rows) => out.push(`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`));

const pass = (r) => (r.verdict === 'disputed' ? r.primary === 'pass' : r.verdict === 'pass');
const applied = (r) => (r.kind === 'unit' ? pass(r) : r.kind === 'harm' && r.class === 'D' ? r.verdict === 'no' : null);
const sel = (f) => ITEMS.filter(f);
function appl(rows) {
  const xs = rows.map(applied).filter((x) => x !== null);
  return { k: xs.filter(Boolean).length, n: xs.length };
}
function harmRuns(runFilter, itemFilter) {
  const rs = RUNS.filter(runFilter);
  const ids = new Set(rs.map((r) => r.run_id));
  const bad = new Set(ITEMS.filter((r) => ids.has(r.run_id) && itemFilter(r) && (r.kind === 'harm' || r.kind === 'mine') && r.verdict === 'yes').map((r) => r.run_id));
  return { k: rs.filter((r) => bad.has(r.run_id)).length, n: rs.length };
}
const base = (r) => r.search === 'none' && r.delivery === 'path';

h('## 1. Применение по тиру, классу и форме (кейсы стадии C: E4, L5, FVB, K1, CFG, E2; поиск не предписан, подача путём)');
{
  const tiers = [['sonnet', 'A'], ['opus', 'C'], ['haiku', 'H']];
  const forms = ['F0', 'F1', 'F4', 'F5'];
  const rows = [];
  for (const [model, stage] of tiers) {
    for (const c of CLASSES) {
      const cells = forms.map((f) => {
        const x = appl(sel((r) => r.model === model && r.stage === stage && C_CASES.includes(r.case) && base(r) && r.form === f && r.class === c));
        return x.n ? kn(x.k, x.n) : '-';
      });
      rows.push([model, c, ...cells]);
    }
  }
  table(['Тир', 'Класс', ...forms], rows);
  out.push('', 'F4 на sonnet в стадии A не гонялся (строка «-»); F4 на кейсах стадии B - таблица 3.');
}

h('## 2. F1 против F5 по тиру и классу (кейсы стадии C): разность и 95% интервал Ньюкомба');
{
  const rows = [];
  for (const [model, stage] of [['sonnet', 'A'], ['opus', 'C'], ['haiku', 'H']]) {
    for (const c of CLASSES) {
      const f = (form) => appl(sel((r) => r.model === model && r.stage === stage && C_CASES.includes(r.case) && base(r) && r.form === form && r.class === c));
      const x = f('F1'); const y = f('F5');
      if (!x.n || !y.n) continue;
      const [d, lo, hi] = newcombe(x.k, x.n, y.k, y.n);
      rows.push([model, c, kn(x.k, x.n), kn(y.k, y.n), `${pct(d)} [${pct(lo)}; ${pct(hi)}]`, fisher(x.k, x.n - x.k, y.k, y.n - y.k).toFixed(3)]);
    }
  }
  table(['Тир', 'Класс', 'F1', 'F5', 'd', 'Фишер p'], rows);
}

h('## 3. Лестница формы, sonnet, кейсы стадии B (E4, R, CFG, N0): pass или событие вреда / прогонов');
{
  const forms = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5'];
  const ids = ['E4-cascade', 'E4-ts', 'E4-clear', 'R-D3', 'CFG-K8', 'CFG-K9', 'R-h-B1', 'N0-h-split', 'N0-h-utc', 'N0-h-contains', 'CFG-h-required', 'R-h-B2'];
  table(['Строка', 'Род', 'Класс', ...forms], ids.map((id) => {
    const rs = sel((r) => r.item_id === id && r.model === 'sonnet' && (r.stage === 'A' || r.stage === 'B') && base(r));
    return [id, rs[0]?.kind ?? '-', rs[0]?.class || '-', ...forms.map((f) => {
      const x = rs.filter((r) => r.form === f);
      const ok = x.filter((r) => (r.kind === 'unit' ? pass(r) : r.verdict === 'yes')).length;
      return x.length ? `${ok}/${x.length}` : '-';
    })];
  }));
  out.push('', 'Для строк unit - число pass, для harm - число ложных находок (меньше - лучше).');
  const forms2 = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5'];
  const rows = forms2.map((f) => {
    const a = appl(sel((r) => r.model === 'sonnet' && (r.stage === 'A' || r.stage === 'B') && B_CASES.includes(r.case) && base(r) && r.form === f));
    const hr = harmRuns((r) => r.model === 'sonnet' && (r.stage === 'A' || r.stage === 'B') && B_CASES.includes(r.case) && base(r) && r.form === f, () => true);
    return [f, knci(a.k, a.n), knci(hr.k, hr.n)];
  });
  h('### 3а. Итог по формам на кейсах стадии B (sonnet)');
  table(['Форма', 'Применение (unit и вред класса D)', 'Прогоны с вредом'], rows);
}

h('## 4. Вред по тиру и форме: прогоны хотя бы с одним событием harm или mine (кейсы стадии C)');
{
  const forms = ['F0', 'F1', 'F4', 'F5'];
  const rows = [];
  for (const [model, stage] of [['sonnet', 'A'], ['opus', 'C'], ['haiku', 'H']]) {
    rows.push([model, ...forms.map((f) => { const v = harmRuns((r) => r.model === model && r.stage === stage && C_CASES.includes(r.case) && base(r) && r.form === f, () => true); return v.n ? kn(v.k, v.n) : '-'; })]);
  }
  table(['Тир', ...forms], rows);
  out.push('', 'Вред класса D (строки harm класса D и fail по unit класса D), все кейсы стадии:');
  const dRows = [];
  for (const [model, stage] of [['sonnet', 'A'], ['opus', 'C'], ['haiku', 'H']]) {
    const ev = (f) => { const rs = sel((r) => r.model === model && r.stage === stage && base(r) && r.form === f && r.class === 'D' && (r.kind === 'harm' || r.kind === 'unit')); return { k: rs.filter((r) => (r.kind === 'harm' ? r.verdict === 'yes' : !pass(r))).length, n: rs.length }; };
    const a = ev('F1'); const b = ev('F5');
    dRows.push([model, ...['F0', 'F1', 'F4', 'F5'].map((f) => { const v = ev(f); return v.n ? kn(v.k, v.n) : '-'; }), b.n && a.n ? fisher(b.k, b.n - b.k, a.k, a.n - a.k).toFixed(3) : '-']);
  }
  out.push('');
  table(['Тир', 'F0', 'F1', 'F4', 'F5', 'Фишер F5 против F1'], dRows);
}

h('## 5. Охват ревью: дефекты вне скилла (coverage), найдено / всего');
{
  const forms = ['F0', 'F1', 'F2', 'F3', 'F4', 'F5'];
  const rows = [];
  for (const [model, stages] of [['sonnet', ['A', 'B']], ['opus', ['C']], ['haiku', ['H']]]) {
    rows.push([model, ...forms.map((f) => { const x = sel((r) => r.kind === 'coverage' && r.model === model && stages.includes(r.stage) && base(r) && r.form === f); return x.length ? knci(x.filter((r) => r.verdict === 'found').length, x.length) : '-'; })]);
  }
  table(['Тир', ...forms], rows);
}

h('## 6. Модификатор «предписан поиск» (sonnet, E3, E4, FVB): стадия A (не предписан) против стадии D (предписан)');
{
  const rows = [];
  for (const f of ['F0', 'F1']) {
    for (const search of ['none', 'prescribed']) {
      const a = appl(sel((r) => r.model === 'sonnet' && ['E3', 'E4', 'FVB'].includes(r.case) && r.delivery === 'path' && r.search === search && r.form === f && (r.stage === 'A' || r.stage === 'D')));
      const rs = RUNS.filter((r) => r.model === 'sonnet' && ['E3', 'E4', 'FVB'].includes(r.case) && r.delivery === 'path' && r.search === search && r.form === f && (r.stage === 'A' || r.stage === 'D'));
      const web = rs.filter((r) => Number(r.web_calls) > 0).length;
      rows.push([f, search === 'none' ? 'не предписан' : 'предписан', knci(a.k, a.n), `${web}/${rs.length}`]);
    }
  }
  table(['Форма', 'Поиск', 'Применение', 'Прогонов с WebSearch/WebFetch'], rows);
}

h('## 7. Модификатор «подача плагином и Skill tool» (sonnet, E1, E4, R, K1): путь (стадия A) против плагина (стадия D)');
{
  const rows = [];
  for (const f of ['F1', 'F5']) {
    for (const delivery of ['path', 'plugin']) {
      const flt = (r) => r.model === 'sonnet' && ['E1', 'E4', 'R', 'K1'].includes(r.case) && r.search === 'none' && r.delivery === delivery && r.form === f && (r.stage === 'A' || r.stage === 'D');
      const a = appl(sel(flt));
      const hr = harmRuns(flt, () => true);
      const rs = RUNS.filter(flt);
      rows.push([f, delivery === 'path' ? 'путь' : 'плагин', knci(a.k, a.n), kn(hr.k, hr.n), `${rs.filter((r) => r.skill_calls).length}/${rs.length}`]);
    }
  }
  table(['Форма', 'Подача', 'Применение', 'Прогоны с вредом', 'Прогонов с вызовом Skill'], rows);
}

h('## 8. Стоимость на прогон (среднее) по тиру и форме');
{
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const rows = [];
  for (const [model, stages] of [['sonnet', ['A', 'B']], ['opus', ['C']], ['haiku', ['H']]]) {
    for (const f of ['F0', 'F1', 'F2', 'F3', 'F4', 'F5']) {
      const rs = RUNS.filter((r) => r.model === model && stages.includes(r.stage) && r.search === 'none' && r.delivery === 'path' && r.form === f);
      if (!rs.length) continue;
      const n = (k) => mean(rs.map((r) => Number(r[k]) || 0));
      rows.push([model, f, rs.length, Math.round(n('input_tokens') + n('cache_write')), Math.round(n('cache_read')), Math.round(n('output_tokens')), n('cost_usd').toFixed(3), (n('duration_ms') / 1000).toFixed(0), `${rs.filter((r) => Number(r.web_calls) > 0).length}/${rs.length}`]);
    }
  }
  table(['Тир', 'Форма', 'Прогонов', 'input + cache write', 'cache read', 'output', '$', 'сек', 'Прогонов с WebSearch/WebFetch'], rows);
  const all = RUNS.reduce((a, r) => a + (Number(r.cost_usd) || 0), 0);
  out.push('', `Всего прогонов исполнителя: ${RUNS.length}, стоимость $${all.toFixed(2)}.`);
}

writeFileSync(join(HERE, 'tables-summary.md'), out.join('\n') + '\n');
console.log('tables-summary.md');
