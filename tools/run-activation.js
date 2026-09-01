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
 * Второй род прогона - `--agents`: виден ли агент в сессии под каноничной формой
 * `{plugin}:{name}`. Кейсы не хранятся, а строятся из дерева `plugins/specialists/`,
 * поэтому разъехаться с диском не могут. Предмет здесь другой и уже: не выбор модели,
 * а факт поставки. Зонд 01.09.2026 показал, почему полноценной пробы активации у агента
 * нет: делегирование - решение по объёму работы, а не первый ход, и на мелкой песочнице
 * не происходит ни при какой формулировке (3 прогона, 0 делегирований), а прямой вопрос
 * «кому передашь» уводит модель в `ListAgents`. Что проба ловит: агент не поставлен,
 * переименован, форма `{plugin}:{name}` разъехалась. Чего НЕ ловит: разрешился ли
 * pre-load `skills:` у самого агента - в `init.skills` скилл виден потому, что его
 * плагин установлен, а не потому, что агент его связал.
 *
 * Usage:
 *   node tools/run-activation.js                       # все кейсы, sonnet, 1 прогон
 *   node tools/run-activation.js --agents --model haiku # видимость всех агентов дерева
 *   node tools/run-activation.js --model opus --runs 3
 *   node tools/run-activation.js --case redis          # подстрока id кейса
 *   node tools/run-activation.js --only a-in,b-in      # точный список id
 *   node tools/run-activation.js --json out.json
 *
 * Exit codes:
 *   0 - все кейсы прошли
 *   1 - хотя бы один провалился
 *   2 - ошибка запуска (нет кейсов, нет claude в PATH)
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

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
const ONLY = arg('only', null);
const CONCURRENCY = Number(arg('concurrency', '4'));
const JSON_OUT = arg('json', null);
const TIMEOUT_MS = Number(arg('timeout', '300')) * 1000;
const AGENTS_MODE = process.argv.includes('--agents');

// Инструменты действия в прогоне активации не нужны и стоят денег: предмет пробы -
// какой Skill выбран, а не что агент сделает дальше.
const DISALLOWED = 'Bash,Write,Edit,WebFetch,WebSearch,Agent,Task';

// Плагин кейса грузится из рабочего дерева (`--plugin-dir`), а не из установки оператора:
// иначе прогон судит чужой снапшот - непоставленный плагин дал бы ложный провал, а
// поставленная старая версия скрыла бы правку `description`, которую и проверяют. Зонд
// 23.08.2026: флаг подменяет источник на `@inline`, дубля в листинге скиллов нет.
function indexPlugins(dir, depth, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (existsSync(join(full, '.claude-plugin', 'plugin.json'))) acc.set(entry.name, full);
    else if (depth > 0) indexPlugins(full, depth - 1, acc);
  }
  return acc;
}
const PLUGIN_DIRS = indexPlugins(join(REPO_ROOT, 'plugins'), 3, new Map());

function runCase(kase) {
  return new Promise((resolvePromise) => {
    const sandbox = mkdtempSync(join(tmpdir(), 'activation-'));
    // `plugins` кейса - плагины сверх того, что несёт `expect`: скилл поднимается не только
    // своим полем, но и хуком соседнего плагина, и такой конструкт проверяется только вместе.
    // Отсутствующий в дереве плагин молча выпадает - кейс тогда судит неполный конструкт,
    // поэтому недостача называется явно (`missing`), а не гасится.
    const names = [kase.expect.split(':')[0], ...(kase.plugins ?? [])];
    const dirs = names.map((n) => PLUGIN_DIRS.get(n)).filter(Boolean);
    const missing = names.filter((n) => !PLUGIN_DIRS.has(n));
    // `git: true` - песочница с git-репой: хуки конвейера отличают репозиторий от случайного
    // каталога и вне репы намеренно молчат, поэтому в пустой директории конструкт не поднялся бы.
    if (kase.git) {
      try {
        execFileSync('git', ['init', '-q'], { cwd: sandbox, stdio: 'ignore' });
        writeFileSync(join(sandbox, 'package.json'), '{"name":"probe","version":"1.0.0"}\n');
      } catch { /* без git кейс отработает как обычный - расхождение видно по исходу */ }
    }
    const args = [
      '-p', kase.prompt,
      '--output-format', 'stream-json',
      '--verbose',
      '--max-turns', String(kase.maxTurns ?? 2),
      '--model', MODEL,
      '--disallowed-tools', kase.kind === 'agent' ? `${DISALLOWED},Read,Glob,Grep,Skill` : DISALLOWED,
      ...dirs.flatMap((d) => ['--plugin-dir', d]),
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
      let listed = null;
      let agents = null;
      for (const line of out.split('\n')) {
        if (!line.trim()) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        if (e.type === 'system' && e.subtype === 'init') {
          if (Array.isArray(e.skills)) listed = e.skills;
          if (Array.isArray(e.agents)) agents = e.agents;
        }
        if (e.type === 'assistant') {
          for (const part of e.message?.content ?? []) {
            if (part.type === 'tool_use' && part.name === 'Skill' && part.input?.skill) skills.push(part.input.skill);
          }
        }
        if (e.type === 'result') cost = e.total_cost_usd ?? 0;
      }
      resolvePromise({ skills, cost, listed, agents, missing });
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

/**
 * Кейсы видимости строятся из дерева, а не хранятся файлом: перечень агентов меняется
 * каждым PR, и хранимая копия разъехалась бы молча - ровно тем же способом, каким
 * разъезжается витрина. Форма ожидания - `{plugin}:{name}`: имя плагина берётся из
 * каталога, имя агента из frontmatter, и несовпадение файла с `name` ловит валидатор.
 */
function agentVisibilityCases() {
  const out = [];
  const base = join(REPO_ROOT, 'plugins', 'specialists');
  for (const cat of readdirSync(base, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const plug of readdirSync(join(base, cat.name), { withFileTypes: true })) {
      if (!plug.isDirectory()) continue;
      const agentsDir = join(base, cat.name, plug.name, 'agents');
      if (!existsSync(agentsDir) || !statSync(agentsDir).isDirectory()) continue;
      for (const f of readdirSync(agentsDir)) {
        if (!f.endsWith('.md')) continue;
        const body = readFileSync(join(agentsDir, f), 'utf8');
        const m = /^name:\s*(\S+)\s*$/m.exec(body);
        const name = m ? m[1] : f.slice(0, -3);
        out.push({
          id: `${name}-visible`,
          kind: 'agent',
          mode: 'in-scope',
          expect: `${plug.name}:${name}`,
          prompt: 'ok',
          maxTurns: 1,
        });
      }
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

let cases;
if (AGENTS_MODE) {
  cases = agentVisibilityCases();
} else {
  try {
    cases = JSON.parse(readFileSync(CASES_FILE, 'utf8'));
  } catch (e) {
    console.error(`Не прочитан ${CASES_FILE}: ${e.message}`);
    process.exit(2);
  }
}
if (FILTER) cases = cases.filter((k) => k.id.includes(FILTER));
if (ONLY) {
  const ids = new Set(ONLY.split(',').map((x) => x.trim()).filter(Boolean));
  const known = new Set(cases.map((k) => k.id));
  const unknown = [...ids].filter((x) => !known.has(x));
  if (unknown.length) { console.error(`Неизвестные id в --only: ${unknown.join(', ')}`); process.exit(2); }
  cases = cases.filter((k) => ids.has(k.id));
}
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
  // Скилла нет в листинге сессии - выбран быть не мог: in-scope дал бы ложный провал,
  // near-miss - ложный зелёный. Прогон судит поле активации, поэтому такой кейс не проходит
  // и не проваливается: он остаётся непроверенным с явным статусом. Причина - либо кейс
  // ссылается на несуществующий плагин (опечатка в `expect`), либо имя скилла внутри
  // плагина другое; и то и другое чинится в кейсе, не молчанием прогона.
  // Плагин из `plugins` кейса не найден в дереве - конструкт поднялся неполным, и его исход
  // не говорит ни о срабатывании, ни о его отсутствии: судится тем же статусом «не проверено».
  const incomplete = (res.missing ?? []).length > 0;
  // Кейс видимости судит листинг агентов сессии, а не выбор модели: агент либо назван в
  // `init.agents` каноничной формой, либо нет. Промежуточного исхода тут не бывает, поэтому
  // ветка отдельная - иначе «агента нет в сессии» попало бы в статус «не проверено», где
  // ему не место: это и есть проверяемый факт.
  if (kase.kind === 'agent') {
    const listedAgents = res.agents;
    const seen = Array.isArray(listedAgents) && listedAgents.includes(kase.expect);
    const unchecked = res.error || incomplete || !Array.isArray(listedAgents);
    const mark = unchecked ? c('yellow', 'ОШИБКА') : seen ? c('green', 'ok    ') : c('red', 'ПРОВАЛ');
    const near = Array.isArray(listedAgents)
      ? listedAgents.filter((a) => a.startsWith(`${kase.expect.split(':')[0]}:`))
      : [];
    const detail = res.error ? res.error
      : incomplete ? `плагин(ы) кейса не найдены: ${res.missing.join(', ')} - не проверено`
      : !Array.isArray(listedAgents) ? 'листинг агентов не получен - не проверено'
      : seen ? kase.expect
      : near.length ? `плагин поднялся, но агент назван иначе: ${near.join(', ')}`
      : 'плагина нет в листинге агентов сессии';
    console.log(`${mark} ${kase.id}${RUNS > 1 ? `#${run + 1}` : ''} [видимость] -> ${c('gray', detail)}`);
    return { id: kase.id, run, kind: 'agent', mode: kase.mode, expect: kase.expect, fired: listedAgents ?? [], pass: seen && !unchecked, bare: false, absent: Boolean(unchecked), unmet: [], foreign: [], contestedWon: null, missing: res.missing ?? [], error: res.error ?? null, cost: res.cost ?? 0 };
  }
  // Кейс может требовать присутствия конкурента: он меряет не «работает ли поле», а величину
  // перехвата, и прогон без конкурента даёт зелёный, который ничего не измеряет. Условие держится
  // полем кейса, а не абзацем README про состояние чьей-то машины: непокрытое требование даёт тот
  // же статус «не проверено», что и отсутствующий скилл, а не ложный зелёный.
  const required = kase.requiresListed ?? [];
  const unmet = Array.isArray(res.listed)
    ? required.filter((n) => !res.listed.includes(n))
    : required;
  const absent = incomplete || unmet.length > 0
    || (Array.isArray(res.listed) && !res.listed.includes(kase.expect));
  const exact = fired.includes(kase.expect);
  // Голое имя плагина - тот же выбор артефакта, но нерезолвимая форма вызова: модель
  // исправляется следующим ходом, который в лимит ходов не всегда помещается. Предмет
  // пробы - сработало ли поле активации, поэтому это попадание, а не провал; форма
  // помечается отдельно (`bare`), иначе дефект вызова тонет в зелёном.
  const bare = !exact && fired.includes(kase.expect.split(':')[0]);
  const hit = exact || bare;
  // Режим `contested`: предмет кейса - не «сработало ли поле», а кто победил в конкуренции за
  // предмет. Обе стороны исхода информативны, поэтому такой кейс не красит прогон в красное и не
  // роняет код возврата: он записывает победителя. Иначе ожидаемый перехват печатался бы ПРОВАЛом,
  // а единственным способом получить зелёный было бы выключить конкурента - ровно то, от чего
  // страхует `requiresListed`.
  const contested = kase.mode === 'contested';
  const pass = res.error || absent ? false : contested ? true : kase.mode === 'near-miss' ? !hit : hit;
  const mark = res.error ? c('yellow', 'ОШИБКА')
    : absent ? c('gray', 'нет   ')
    : contested ? (hit ? c('green', 'наш   ') : c('yellow', 'перехв'))
    : pass ? (bare ? c('yellow', 'ok/гол') : c('green', 'ok    '))
    : c('red', 'ПРОВАЛ');
  const detail = res.error ? res.error
    : incomplete ? `плагин(ы) кейса не найдены: ${res.missing.join(', ')} - не проверено`
    : unmet.length ? `нет в сессии требуемого кейсом: ${unmet.join(', ')} - не проверено`
    : absent ? 'скилла нет в сессии - не проверено'
    : fired.length ? fired.join(', ') : 'ни одного Skill';
  console.log(`${mark} ${kase.id}${RUNS > 1 ? `#${run + 1}` : ''} [${kase.mode}] -> ${c('gray', detail)}`);
  // Сторонние скиллы листинга - это и есть среда конкуренции, в которой получен исход. Без записи
  // «7/7 при живом конкуренте» и «7/7 при выключенном» неразличимы задним числом.
  const foreign = (res.listed ?? []).filter((n) => !n.startsWith('dex-'));
  return { id: kase.id, run, mode: kase.mode, expect: kase.expect, fired, pass, bare, absent, unmet, foreign, contestedWon: contested ? hit : null, missing: res.missing ?? [], error: res.error ?? null, cost: res.cost ?? 0 };
}, CONCURRENCY);

const absent = outcomes.filter((o) => o.absent);
const failed = outcomes.filter((o) => !o.pass && !o.absent);
const bareHits = outcomes.filter((o) => o.bare);
const cost = outcomes.reduce((s, o) => s + o.cost, 0);
const secs = Math.round((Date.now() - started) / 1000);

const checked = outcomes.length - absent.length;
console.log(`\n${COLORS.bold}Итог:${COLORS.reset} ${checked} проверено из ${outcomes.length}, ${c('green', `${checked - failed.length} прошло`)}, ${failed.length ? c('red', `${failed.length} провал`) : '0 провалов'}, $${cost.toFixed(3)}, ${secs}s, модель ${MODEL}`);
if (absent.length && AGENTS_MODE) console.log(c('gray', `Не проверено - листинг агентов не получен либо плагин не найден: ${absent.length}. Это не вердикт о видимости, а несостоявшийся прогон.`));
if (absent.length && !AGENTS_MODE) console.log(c('gray', `Не проверено - скилла нет в листинге сессии: ${absent.length} (${[...new Set(absent.map((o) => o.expect))].join(', ')}). Поле этих скиллов не проверено ничем. Причину называют строки ниже - нет плагина в `+'`plugins/`'+` либо не выполнено требование кейса; ни одной такой строки нет - значит плагин в дереве есть и имя верно, а в листинг сессии скилл не попал.`));
const contests = outcomes.filter((o) => o.contestedWon !== null && !o.absent);
if (contests.length) console.log(c('gray', `Спорных за предмет: ${contests.length}, из них наш скилл поднялся в ${contests.filter((o) => o.contestedWon).length}. Режим `+'`contested`'+` меряет величину перехвата и код возврата не роняет.`));
const unmets = outcomes.filter((o) => o.unmet.length);
if (unmets.length) console.log(c('gray', `Не проверено - в сессии нет требуемого кейсами: ${[...new Set(unmets.flatMap((o) => o.unmet))].join(', ')}. Поле `+'`requiresListed`'+` называет конкурента, без которого исход кейса ничего не измеряет - включить плагин и прогнать заново.`));
const incompletes = outcomes.filter((o) => o.missing.length);
if (incompletes.length) console.log(c('gray', `Не проверено - плагины кейса отсутствуют в plugins/: ${[...new Set(incompletes.flatMap((o) => o.missing))].join(', ')}. Поле `+'`plugins`'+` кейса называет плагин, которого в дереве нет - конструкт судить нечем.`));
if (bareHits.length) console.log(c('yellow', `Голым именем плагина (вызов не резолвится, попадание засчитано): ${bareHits.length} - ${bareHits.map((o) => o.id).join(', ')}`));

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ model: MODEL, runs: RUNS, outcomes }, null, 2) + '\n');
  console.log(`JSON: ${JSON_OUT}`);
}

process.exit(failed.length ? 1 : 0);
