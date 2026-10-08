#!/usr/bin/env node
// Дословные инварианты пакета плана (самопроверка планировщика, `SKILL.md`): то, что решается
// разбором таблицы, а не чтением. Смысловая половина (разумность декомпозиции, качество брифов)
// судится чтением и сюда не входит.
//
//   node lint-pack.mjs <каталог пакета> [--expect orchestrate|solo] [--max-parallel N]
//
// Код выхода: 0 - все инварианты соблюдены, 1 - есть провал, 2 - пакет не читается.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '.');
const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const expect = arg('expect');
const planPath = join(dir, 'PLAN.md');
if (!existsSync(planPath)) { console.error(`нет ${planPath}`); process.exit(2); }
const plan = readFileSync(planPath, 'utf8');

const fails = [];
const notes = [];
const fail = (m) => fails.push(m);

const head = plan.match(/^---\n([\s\S]*?)\n---/);
if (!head) { fail('нет YAML-шапки'); }
const H = head ? head[1] : '';
const verdict = (H.match(/^scheme:\s*(\w+)/m) || [])[1];
if (!/^format:\s*orchestration-pack\/1/m.test(H)) fail('format != orchestration-pack/1');
if (!['orchestrate', 'solo'].includes(verdict)) fail(`scheme не из {orchestrate, solo}: ${verdict}`);
if (expect && verdict !== expect) fail(`схема ${verdict}, ожидали ${expect}`);

const lim = (k) => { const m = H.match(new RegExp(`${k}:\\s*([\\w.]+)`)); return m ? m[1] : undefined; };
const maxParallel = Number(lim('max_parallel'));
const maxSpawn = Number(lim('max_spawn'));
const maxAttempts = Number(lim('max_attempts'));
if (verdict === 'orchestrate') {
  if (!(maxParallel >= 1)) fail('max_parallel не задан');
  if (!(maxSpawn >= 1)) fail('max_spawn не задан');
  if (!(maxAttempts >= 1)) fail('max_attempts не задан');
  const cap = arg('max-parallel');
  if (cap && maxParallel > Number(cap)) fail(`max_parallel ${maxParallel} выше лимита пользователя ${cap}`);
}

// Таблица задач: заголовок с колонками id, модель, effort.
function parseTables(md) {
  const lines = md.split('\n');
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|') && /^\|[\s:|-]+\|$/.test(lines[i + 1] ?? '')) {
      const cols = lines[i].split('|').slice(1, -1).map((s) => s.trim().toLowerCase());
      const rows = [];
      let j = i + 2;
      for (; j < lines.length && lines[j].startsWith('|'); j++) rows.push(lines[j].split('|').slice(1, -1).map((s) => s.trim()));
      tables.push({ cols, rows });
      i = j;
    }
  }
  return tables;
}
const tasksTable = parseTables(plan).find((t) => t.cols.includes('id') && t.cols.some((c) => c.startsWith('модель')) && t.cols.includes('effort'));

const RANK = { haiku: 1, sonnet: 2, opus: 3 };
const EFFORT = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

if (verdict === 'orchestrate') {
  if (!tasksTable) fail('нет таблицы задач с колонками id / модель / effort');
} else if (verdict === 'solo') {
  if (existsSync(join(dir, 'briefs')) && existsSync(join(dir, 'briefs/T1.md'))) fail('solo, но есть брифы задач');
}

if (tasksTable) {
  const ix = (name) => tasksTable.cols.findIndex((c) => c === name || c.startsWith(name));
  const iExec = ix('исполнитель');
  const iId = ix('id'), iDep = ix('завис'), iModel = ix('модель'), iEff = ix('effort'), iAxes = ix('оси') >= 0 ? ix('оси') : ix('a/b'), iWrites = ix('пишет'), iCheck = ix('check'), iBrief = ix('бриф');
  const ids = new Set(tasksTable.rows.map((r) => r[iId]));
  const deps = new Map();
  const wr = new Map();
  for (const r of tasksTable.rows) {
    const id = r[iId];
    const model = (r[iModel] ?? '').replace(/`/g, '').toLowerCase();
    const eff = (r[iEff] ?? '').replace(/`/g, '').toLowerCase();
    const isSelf = iExec >= 0 ? /self/i.test(r[iExec] ?? '') : model === 'self';
    if (!isSelf && !(model in RANK)) fail(`${id}: модель «${model}» вне {haiku, sonnet, opus}`);
    if (!isSelf && !EFFORT.has(eff)) fail(`${id}: effort «${eff}» не задан явно`);
    if (model === 'haiku' && eff === 'low' && false) notes.push(id);
    if (iCheck >= 0 && !(r[iCheck] ?? '').replace(/[-–—\s]/g, '')) fail(`${id}: пустой check`);
    if (iBrief >= 0 && !isSelf) {
      const b = (r[iBrief] ?? '').replace(/`/g, '');
      if (!b || !existsSync(join(dir, b.includes('/') ? b : `briefs/${b}`))) fail(`${id}: бриф «${b}» не найден`);
    }
    if (iAxes >= 0) {
      const m = (r[iAxes] ?? '').match(/(\d)\s*\/\s*(\d)\s*\/\s*(\d)\s*\/\s*(\d)/);
      if (m && m[2] === '2' && model === 'haiku') fail(`${id}: B=2 на haiku`);
    }
    deps.set(id, (r[iDep] ?? '').split(/[,\s]+/).map((s) => s.replace(/`/g, '')).filter((s) => ids.has(s)));
    if (iWrites >= 0) wr.set(id, (r[iWrites] ?? '').replace(/`/g, '').split(/[,;]\s*/).filter(Boolean));
  }
  // циклы
  const state = new Map();
  const visit = (n) => { if (state.get(n) === 1) return true; if (state.get(n) === 2) return false; state.set(n, 1); for (const d of deps.get(n) ?? []) if (visit(d)) return true; state.set(n, 2); return false; };
  for (const id of ids) if (visit(id)) { fail(`цикл в графе зависимостей через ${id}`); break; }
  // пересечение записи у независимых задач (грубо: одинаковые пути)
  const reach = (a, b) => { const seen = new Set(); const st = [a]; while (st.length) { const x = st.pop(); for (const d of deps.get(x) ?? []) { if (d === b) return true; if (!seen.has(d)) { seen.add(d); st.push(d); } } } return false; };
  const list = [...ids];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [a, b] = [list[i], list[j]];
    if (reach(a, b) || reach(b, a)) continue;
    const shared = (wr.get(a) ?? []).filter((p) => (wr.get(b) ?? []).includes(p) && !/reports\//.test(p));
    if (shared.length) fail(`независимые ${a} и ${b} пишут в один путь: ${shared.join(', ')}`);
  }
  if (maxSpawn && ids.size > maxSpawn) fail(`задач ${ids.size} больше max_spawn ${maxSpawn}`);
}

// Запрещённое в тексте пакета: модели вне 5.5, датированные id, «думай меньше», просьба выписать рассуждения.
const all = [plan, ...['_template.md', ...(tasksTable ? tasksTable.rows.map((r) => `${r[0]}.md`) : [])].map((f) => { const p = join(dir, 'briefs', f); return existsSync(p) ? readFileSync(p, 'utf8') : ''; })].join('\n');
if (/claude-(?:opus|sonnet|haiku)-(?:4|3)[-\d.]*/i.test(all) && !/не использ|вне 5\.5|не берём/i.test(all)) notes.push('упомянута модель вне 5.5 (проверить контекст)');
if (/\b\d{8}\b/.test(all.match(/claude-[\w-]*\d{8}/g)?.join(' ') ?? '')) fail('датированный id модели');
if (/думай меньше|отвечай сразу|think less/i.test(readBriefsOnly(dir, tasksTable))) fail('в брифе просьба «думай меньше»');
if (/выпиши (?:цепочку )?рассуждени|chain[- ]of[- ]thought|step[- ]by[- ]step reasoning/i.test(readBriefsOnly(dir, tasksTable))) fail('в брифе просьба выписать рассуждения');

function readBriefsOnly(d, t) {
  if (!t) return '';
  return t.rows.map((r) => { const p = join(d, 'briefs', `${r[0]}.md`); return existsSync(p) ? readFileSync(p, 'utf8') : ''; }).join('\n');
}

console.log(JSON.stringify({ dir, verdict, tasks: tasksTable?.rows.length ?? 0, max_parallel: maxParallel || null, max_spawn: maxSpawn || null, fails, notes }, null, 2));
process.exit(fails.length ? 1 : 0);
