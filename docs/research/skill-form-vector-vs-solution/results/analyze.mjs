#!/usr/bin/env node
/**
 * Таблицы отчёта из results.csv и runs.csv. Все числа README.md строятся этим скриптом.
 *
 *   node results/analyze.mjs --stage A [--model sonnet] [--search none] [--delivery path] [--forms F0,F1,F5]
 * Выход: results/tables-<метка>.md (метка - stage или --label).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, wilson, newcombe, fisher } from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const STAGES = opt('stage', 'A').split(',');
const FILTER = { model: opt('model'), search: opt('search'), delivery: opt('delivery') };
const LABEL = opt('label', STAGES.join(''));

const pass = (r, flip) => {
  // disputed: основной анализ - по полю primary ключа, чувствительность - наоборот.
  if (r.verdict === 'disputed') return flip ? r.primary !== 'pass' : r.primary === 'pass';
  return r.verdict === 'pass';
};
const keep = (r) => STAGES.includes(r.stage) && Object.entries(FILTER).every(([k, v]) => !v || r[k] === v);
const items = parseCsv(readFileSync(join(HERE, 'results.csv'), 'utf8')).filter(keep).filter((r) => r.verdict);
const runs = parseCsv(readFileSync(join(HERE, 'runs.csv'), 'utf8')).filter(keep);
const FORMS = opt('forms', [...new Set(items.map((r) => r.form))].sort().join(',')).split(',');
const CLASSES = ['A', 'B', 'C', 'D'];

const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '-');
const kn = (k, n) => (n ? `${k}/${n} (${pct(k / n)}; ${pct(wilson(k, n)[0])}-${pct(wilson(k, n)[1])})` : '-');
const out = [];
const h = (s) => out.push('', s, '');
const table = (cols, rows) => { out.push(`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)); };
const isHarm = (r) => (r.kind === 'harm' || r.kind === 'mine') && r.verdict === 'yes';

// Применение: строки unit; для класса D ещё и harm класса D (no = применено).
function appl(rows, flip = false) {
  const res = {};
  for (const r of rows) {
    let ok;
    if (r.kind === 'unit') ok = pass(r, flip);
    else if (r.kind === 'harm' && r.class === 'D') ok = r.verdict === 'no';
    else continue;
    const key = `${r.class}|${r.form}`;
    res[key] ??= { k: 0, n: 0 };
    res[key].n++; if (ok) res[key].k++;
  }
  return res;
}

// Доля прогонов с вредом среди прогонов формы (опционально - только кейсы из набора).
function harmRuns(form, cases) {
  const rs = runs.filter((r) => r.form === form && (!cases || cases.has(r.case)));
  const bad = new Set(items.filter((r) => r.form === form && (!cases || cases.has(r.case)) && isHarm(r)).map((r) => r.run_id));
  return { k: rs.filter((r) => bad.has(r.run_id)).length, n: rs.length };
}

out.push(`# Таблицы: стадии ${STAGES.join(', ')}${Object.values(FILTER).some(Boolean) ? `, фильтр ${JSON.stringify(FILTER)}` : ''}`);
out.push('', `Прогонов: ${runs.length}; строк оценки: ${items.length}. Сгенерировано results/analyze.mjs из results.csv и runs.csv.`);

for (const [title, flip] of [['Применение по классу и форме (k/n, доля, 95% Уилсон)', false], ['Чувствительность: disputed наоборот', true]]) {
  h(`## ${title}`);
  const a = appl(items, flip);
  table(['Класс', ...FORMS], CLASSES.map((c) => [c, ...FORMS.map((f) => kn(a[`${c}|${f}`]?.k ?? 0, a[`${c}|${f}`]?.n ?? 0))]));
}

h('## F1 против F5 по классу: решающее правило PREREG');
{
  const a = appl(items);
  const rows = [];
  for (const c of CLASSES) {
    const x = a[`${c}|F1`]; const y = a[`${c}|F5`];
    if (!x || !y) { rows.push([c, '-', '-', '-', '-', '-', 'нет данных']); continue; }
    const [d, lo, hi] = newcombe(x.k, x.n, y.k, y.n);
    const p = fisher(x.k, x.n - x.k, y.k, y.n - y.k);
    const cases = new Set(items.filter((r) => r.class === c).map((r) => r.case));
    const h1 = harmRuns('F1', cases); const h5 = harmRuns('F5', cases);
    const r1 = h1.k / h1.n; const r5 = h5.k / h5.n;
    let verdict = 'не решено';
    if (hi < 0) verdict = 'вектора не хватает';
    else if (d >= -0.10 && lo > -0.30 && !(r1 > r5)) verdict = 'вектора достаточно';
    rows.push([c, kn(x.k, x.n), kn(y.k, y.n), `${pct(d)} [${pct(lo)}; ${pct(hi)}]`, p.toFixed(3), `F1 ${h1.k}/${h1.n}, F5 ${h5.k}/${h5.n}`, verdict]);
  }
  table(['Класс', 'F1', 'F5', 'd = F1-F5 [95% Ньюкомб]', 'Фишер p', 'Прогоны с вредом (кейсы класса)', 'Вердикт'], rows);
}

h('## Вред: прогоны хотя бы с одним событием harm или mine');
{
  table(['Форма', 'Прогоны с вредом'], FORMS.map((f) => { const v = harmRuns(f); return [f, kn(v.k, v.n)]; }));
  const f1 = harmRuns('F1'); const f5 = harmRuns('F5');
  if (f1.n && f5.n) out.push('', `F5 против F1: Фишер p = ${fisher(f5.k, f5.n - f5.k, f1.k, f1.n - f1.k).toFixed(3)}.`);
}

h('## Вред по строкам ключа (yes / прогонов)');
{
  const ids = [...new Set(items.filter((r) => r.kind === 'harm' || r.kind === 'mine').map((r) => r.item_id))].sort();
  table(['Строка', 'Вид', 'Класс', ...FORMS], ids.map((id) => {
    const rs = items.filter((r) => r.item_id === id);
    return [id, rs[0].kind, rs[0].class || '-', ...FORMS.map((f) => { const x = rs.filter((r) => r.form === f); return x.length ? `${x.filter((r) => r.verdict === 'yes').length}/${x.length}` : '-'; })];
  }));
}

h('## Применение по единице (pass / прогонов)');
{
  const ids = [...new Set(items.filter((r) => r.kind === 'unit').map((r) => r.item_id))].sort();
  table(['Строка', 'Единица', 'Класс', ...FORMS], ids.map((id) => {
    const rs = items.filter((r) => r.item_id === id);
    return [id, rs[0].unit, rs[0].class, ...FORMS.map((f) => { const x = rs.filter((r) => r.form === f); return x.length ? `${x.filter((r) => pass(r)).length}/${x.length}` : '-'; })];
  }));
  if (FORMS.includes('F1') && FORMS.includes('F5')) {
    let ge = 0; let tot = 0;
    for (const id of ids) {
      const rs = items.filter((r) => r.item_id === id);
      if (!rs.some((r) => r.form === 'F1') || !rs.some((r) => r.form === 'F5')) continue;
      tot++;
      if (rs.filter((r) => r.form === 'F1' && pass(r)).length >= rs.filter((r) => r.form === 'F5' && pass(r)).length) ge++;
    }
    out.push('', `Единиц, где F1 не ниже F5 по числу pass: ${ge} из ${tot}.`);
  }
}

h('## Охват (coverage - дефекты вне скилла) и recall скилла (skill)');
table(['Род', ...FORMS], ['coverage', 'skill'].map((kind) => [kind, ...FORMS.map((f) => {
  const x = items.filter((r) => r.kind === kind && r.form === f);
  return kn(x.filter((r) => r.verdict === 'found').length, x.length);
})]));

h('## Стоимость на прогон (среднее)');
{
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  table(['Форма', 'Прогонов', 'input + cache write', 'cache read', 'output', '$', 'сек', 'ходов', 'вызовов инструментов', 'WebSearch/WebFetch (прогонов с вызовом)', 'прочитал SKILL.md', 'init чистый'], FORMS.map((f) => {
    const rs = runs.filter((r) => r.form === f);
    const n = (k) => mean(rs.map((r) => Number(r[k]) || 0));
    return [f, rs.length, Math.round(n('input_tokens') + n('cache_write')), Math.round(n('cache_read')), Math.round(n('output_tokens')), n('cost_usd').toFixed(3), (n('duration_ms') / 1000).toFixed(0), n('turns').toFixed(1), n('tool_calls').toFixed(1),
      `${rs.reduce((a, r) => a + (Number(r.web_calls) || 0), 0)} (${rs.filter((r) => Number(r.web_calls) > 0).length})`,
      rs.filter((r) => r.read_skill === 'true').length, rs.filter((r) => r.init_clean === 'true').length];
  }));
  out.push('', `Итого по отобранным прогонам: $${runs.reduce((a, r) => a + (Number(r.cost_usd) || 0), 0).toFixed(2)}.`);
}

writeFileSync(join(HERE, `tables-${LABEL}.md`), out.join('\n') + '\n');
console.log(`tables-${LABEL}.md: ${runs.length} прогонов, ${items.length} строк`);
