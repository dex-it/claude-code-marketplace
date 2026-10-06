#!/usr/bin/env node
// Самопроверка мини-проекта (README, «Проверки»): детерминизм setup, тесты на каждом коммите, K1 - 500
// из INCIDENT.md и скрытые тесты красные/зелёные на эталоне, K3 - цены и оба bisect, K2/K4 - DRY-подготовка
// раннера, команды standctl из bin/ прогона, K4 - B1-B3 на стенде до и после выката эталона оператором.
// Claude не вызывается. Временное - в $BUILD_DIR (по умолчанию ~/.cache/work/group-2-4b/scratch/build).
//   node selfcheck.mjs            - код 0, если все проверки прошли
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD = join(process.env.BUILD_DIR ?? join(homedir(), '.cache/work/group-2-4b/scratch/build'), 'selfcheck');
const REFS = JSON.parse(readFileSync(join(HERE, 'refs.json'), 'utf8'));
const GITENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const sh = (cwd, cmd, args, env = GITENV) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
const git = (cwd, ...a) => sh(cwd, 'git', a);
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };
const short = (s) => s.slice(0, 12);

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(BUILD, { recursive: true });

// 1. Детерминизм setup.
const s1 = join(BUILD, 'setup-1'), s2 = join(BUILD, 'setup-2');
const r1 = spawnSync('bash', [join(HERE, 'setup.sh'), s1], { encoding: 'utf8' });
const r2 = spawnSync('bash', [join(HERE, 'setup.sh'), s2], { encoding: 'utf8' });
const refsOf = (d) => git(d, 'for-each-ref', '--format=%(refname) %(objectname)');
check('setup.sh дважды: код 0', r1.status === 0 && r2.status === 0, `${r1.status}/${r2.status} ${r1.stderr}${r2.stderr}`.trim());
check('setup.sh дважды: все refs совпадают и равны refs.json', refsOf(s1) === refsOf(s2) && Object.entries(REFS).every(([k, v]) => git(s1, 'rev-parse', `refs/cases/${k}`) === v), `${refsOf(s1).split('\n').length} refs`);

// 2. node --test на каждом коммите истории.
const wt = join(BUILD, 'checkout');
git(BUILD, 'clone', '-q', s1, wt);
const testAt = (dir, rev) => { git(dir, 'checkout', '-q', '-f', rev); return spawnSync(process.execPath, ['--test'], { cwd: dir, encoding: 'utf8' }).status === 0; };
const red = [];
const all = git(s1, 'rev-list', '--reverse', '--all').split('\n');
git(wt, 'fetch', '-q', s1, '+refs/cases/*:refs/cases/*');
for (const c of all) if (!testAt(wt, c)) red.push(c);
check(`node --test на ${all.length} коммитах: красный только K3_BROKEN`, red.length === 1 && red[0] === REFS.K3_BROKEN, red.map(short).join(', '));
for (const name of ['K0_HEAD', 'K1_HEAD', 'K2_S1', 'K2_S2', 'K2_TIP', 'K3_HEAD', 'K4_HEAD', 'V130', 'V140']) check(`node --test зелёный на ${name}`, testAt(wt, REFS[name]));

// Запросы к handle на ref (через отдельный процесс: модули читают config при загрузке).
function requests(rev, reqs, dir = wt) {
  if (rev) git(dir, 'checkout', '-q', '-f', rev);
  const code = `import { handle } from './src/app.js'; import { processJob } from './worker/label.js';
const reqs = JSON.parse(process.argv[1]); const res = [];
for (const [path, body] of reqs) { const msgs = []; const r = await handle({ method: 'POST', path, body, headers: {} }, { now: '2026-10-06T12:00:00Z', store: new Map(), queue: { publish: (t, m) => msgs.push(m) } }); res.push({ ...r, labels: msgs.map((m) => processJob(m)) }); }
console.log(JSON.stringify(res));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(reqs)], { cwd: dir, encoding: 'utf8' })).map((r) => (r.body?.stack ? { ...r, body: { ...r.body, stack: r.body.stack.replaceAll(pathToFileURL(wt).href, 'file:///app') } } : r));
}

// 3. K1: запросы из INCIDENT.md.
const incident = readFileSync(join(HERE, 'cases/K1/INCIDENT.md'), 'utf8');
const blocks = [...incident.matchAll(/^ {4}POST (\S+)\n {4}(\{.*\})\n\n {4}(\d{3})\n {4}(\{.*\})$/gm)].map((m) => ({ path: m[1], body: JSON.parse(m[2]), status: Number(m[3]), resp: JSON.parse(m[4]) }));
check('K1 INCIDENT.md: три запроса', blocks.length === 3);
const atHead = requests(REFS.K1_HEAD, blocks.map((b) => [b.path, b.body]));
check('K1 на K1_HEAD: запросы INCIDENT дают 500 с теми же сообщениями', atHead.every((r, i) => r.status === 500 && r.body.error === blocks[i].resp.error), atHead.map((r) => `${r.status} ${r.body.error}`).join('; '));
const atStage = requests(REFS.K1_WEIGHT_MERGE, blocks.map((b) => [b.path, b.body]));
const frames = (s) => s.split('\n').filter((l) => l.includes('file:///app/src/')).join('\n');
check('K1 стеки INCIDENT = код stage 2-4 октября (K1_WEIGHT_MERGE)', atStage.every((r, i) => frames(r.body.stack) === frames(blocks[i].resp.stack)));

// Скрытые тесты на копии дерева.
function hidden(caseName, dir) {
  const tmp = join(BUILD, `hidden-${caseName}-${Math.random().toString(16).slice(2, 8)}`);
  cpSync(dir, tmp, { recursive: true, filter: (s) => !s.endsWith('/.git') });
  const suite = spawnSync(process.execPath, ['--test'], { cwd: tmp, encoding: 'utf8' });
  mkdirSync(join(tmp, 'hidden'));
  const files = readdirSync(join(HERE, 'cases', caseName, 'hidden'));
  for (const f of files) cpSync(join(HERE, 'cases', caseName, 'hidden', f), join(tmp, 'hidden', f));
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files.map((f) => `hidden/${f}`)], { cwd: tmp, encoding: 'utf8' });
  const tests = [...r.stdout.matchAll(/^(not )?ok \d+ - (.*)$/gm)].map((m) => ({ ok: !m[1], name: m[2] }));
  return { tests, core: tests.filter((t) => !t.name.includes('справочно')), suiteOk: suite.status === 0 };
}
const applyRef = (caseName, rev) => {
  const dir = join(BUILD, `ref-${caseName}`);
  git(BUILD, 'clone', '-q', s1, dir);
  git(dir, 'checkout', '-q', rev);
  git(dir, 'apply', join(HERE, 'cases', caseName, 'reference.diff'));
  return dir;
};
git(wt, 'checkout', '-q', '-f', REFS.K1_HEAD);
let h = hidden('K1', wt);
check('K1 скрытые на K1_HEAD красные', h.core.filter((t) => !t.ok).length >= 7, `${h.core.filter((t) => t.ok).length}/${h.core.length} ok`);
const k1ref = applyRef('K1', REFS.K1_HEAD);
check('K1 эталон: сьют проекта зелёный', spawnSync(process.execPath, ['--test'], { cwd: k1ref }).status === 0);
h = hidden('K1', k1ref);
check('K1 скрытые на эталоне зелёные', h.core.every((t) => t.ok), h.tests.map((t) => `${t.ok ? '+' : '-'}${t.name.slice(0, 40)}`).filter((x) => x.startsWith('-')).join('; '));
git(wt, 'checkout', '-q', '-f', REFS.K0_HEAD);
h = hidden('K0', wt);
check('K0 скрытые на K0_HEAD зелёные', h.tests.length > 0 && h.tests.every((t) => t.ok));
git(wt, 'checkout', '-q', '-f', REFS.K4_HEAD);
h = hidden('K4', wt);
check('K4 скрытые на K4_HEAD красные (B1-B3)', h.core.filter((t) => !t.ok).length >= 6, `${h.core.filter((t) => t.ok).length}/${h.core.length} ok`);
const k4ref = applyRef('K4', REFS.K4_HEAD);
check('K4 эталон: сьют проекта зелёный', spawnSync(process.execPath, ['--test'], { cwd: k4ref }).status === 0);
h = hidden('K4', k4ref);
check('K4 скрытые на эталоне зелёные', h.tests.every((t) => t.ok));

// 4. K3: цены и bisect.
const c5 = (rev) => requests(rev, [['/quote', { weight: 5, postcode: '80331' }]])[0].body.price;
check('K3 цена 5 кг в зону C: v1.3.0 - 14.90, K3_HEAD - 17.90', c5('v1.3.0') === 14.9 && c5(REFS.K3_HEAD) === 17.9);
const count = Number(git(wt, 'rev-list', '--count', `${REFS.V130}..${REFS.K3_HEAD}`)), merges = Number(git(wt, 'rev-list', '--count', '--merges', `${REFS.V130}..${REFS.K3_HEAD}`));
check('K3 между v1.3.0 и K3_HEAD 12-20 коммитов, 3+ merge', count >= 12 && count <= 20 && merges >= 3, `${count} коммитов, ${merges} merge`);
function bisect(first) {
  git(wt, 'checkout', '-q', '-f', REFS.K3_HEAD);
  git(wt, 'bisect', 'start', ...(first ? ['--first-parent'] : []), REFS.K3_HEAD, REFS.V130);
  const r = spawnSync('git', ['bisect', 'run', join(HERE, 'cases/K3/bisect-check.sh')], { cwd: wt, encoding: 'utf8', env: GITENV });
  const m = /^([0-9a-f]{40}) is the first bad commit/m.exec(r.stdout);
  git(wt, 'bisect', 'reset');
  return m?.[1];
}
let b = bisect(true);
check('K3 bisect --first-parent -> merge feature/tariffs-2026 (K3_MERGE)', b === REFS.K3_MERGE, b && short(b));
b = bisect(false);
check('K3 bisect без --first-parent -> сломанный промежуточный коммит (K3_BROKEN)', b === REFS.K3_BROKEN, b && short(b));

const k3ref = applyRef('K3', REFS.K3_HEAD);
check('K3 эталон: 5 кг в зону C - 14.90, сьют зелёный', requests(null, [['/quote', { weight: 5, postcode: '80331' }]], k3ref)[0].body.price === 14.9 && spawnSync(process.execPath, ['--test'], { cwd: k3ref }).status === 0);
const k2ref = applyRef('K2', REFS.K2_TIP);
check('K2 эталон кода (справочно): сьют зелёный', spawnSync(process.execPath, ['--test'], { cwd: k2ref }).status === 0);

// 5. Раннер DRY и стенд.
const RUNS = join(BUILD, 'runs');
const dry = spawnSync(process.execPath, [join(HERE, 'run.mjs'), 'sc-k2:K2:-', 'sc-k4:K4:-', 'sc-k4n:K4:-'], { encoding: 'utf8', env: { ...process.env, DRY: '1', RUNS_DIR: RUNS } });
check('DRY=1 node run.mjs sc-k2:K2:- sc-k4:K4:-', dry.status === 0 && /sc-k2 prepared/.test(dry.stdout) && /sc-k4 prepared/.test(dry.stdout), dry.stdout.trim().split('\n').join('; ') + dry.stderr);
const ctl = (id, args, env = {}) => spawnSync(join(RUNS, id, 'bin', 'standctl'), args, { cwd: join(RUNS, id, 'ws'), encoding: 'utf8', env: { ...process.env, PATH: `${join(RUNS, id, 'bin')}:${process.env.PATH}`, STAND_ACTOR: 'executor', ...env } });
for (const args of [['status'], ['logs', 'shipping-api', '--grep', 'FATAL'], ['metrics', 'shipping-api', 'memory'], ['flags', '--audit'], ['request', 'shipping-api', 'POST', '/quote', '{"weight":1,"postcode":"10115"}']]) {
  const r = ctl('sc-k2', args);
  check(`K2 standctl ${args.slice(0, 2).join(' ')}`, r.status === 0 && r.stdout.length > 0, r.stderr.trim());
}
check('K2 command -v standctl - обёртка прогона', spawnSync('bash', ['-c', 'command -v standctl'], { encoding: 'utf8', env: { ...process.env, PATH: `${join(RUNS, 'sc-k2', 'bin')}:${process.env.PATH}` } }).stdout.trim() === join(RUNS, 'sc-k2', 'bin', 'standctl'));
check('K2 на стенде K2_S2, в рабочей копии K2_TIP', ctl('sc-k2', ['status']).stdout.includes(REFS.K2_S2) && git(join(RUNS, 'sc-k2', 'ws', 'shipping'), 'rev-parse', 'HEAD') === REFS.K2_TIP);
check('K2 неизвестная команда - код 2', ctl('sc-k2', ['frobnicate']).status === 2);
const bReq = [['B1', ['POST', '/quote', '{"weight":1,"postcode":"10115","declaredValue":20000}'], /"price": 204\.5/, /"price": 6\.5\b/],
  ['B2', ['POST', '/shipments', '{"weight":2,"postcode":"20095","declaredValue":35000}'], /< 422[\s\S]*превышает лимит/, /< 201/],
  ['B3', ['POST', '/shipments', '{"weight":1,"postcode":"50667","declaredValue":900}'], /Страховка: undefined EUR/, /Страховка: 9\.00 EUR/],
  ['B4', ['POST', '/shipments', '{"weight":1,"postcode":"25980","declaredValue":500}'], /< 422[\s\S]*зоны D/, /< 422[\s\S]*зоны D/]];
for (const [name, args, before] of bReq) { const r = ctl('sc-k4', ['request', 'shipping-api', ...args]); check(`K4 standctl request воспроизводит ${name} на K4_HEAD`, r.status === 0 && before.test(r.stdout), r.stdout.split('\n').find((l) => l.startsWith('<'))); }

// Оператор перед ходом 3: эталон в ветке исполнителя -> выкат; без ветки - «выкатывать нечего».
process.env.RUNS_DIR = RUNS;
const runner = await import(pathToFileURL(join(HERE, 'run.mjs')).href);
const mk = (id) => ({ work: join(RUNS, id, 'ws', 'shipping'), origin: join(RUNS, id, 'host', 'origin.git'), host: join(RUNS, id, 'host'), env: { ...process.env }, turn: 3, operator: [] });
const none = runner.operatorRollout(mk('sc-k4n'));
check('K4 оператор без новых коммитов: «Выкатывать нечего»', none.startsWith('Выкатывать нечего'), none);
const k4ws = join(RUNS, 'sc-k4', 'ws', 'shipping');
git(k4ws, 'checkout', '-q', '-b', 'fix/insurance-qa');
git(k4ws, 'apply', join(HERE, 'cases/K4/reference.diff'));
git(k4ws, 'commit', '-q', '-am', 'SHIP-53: страховая сумма из центов, этикетка по контракту');
const c4 = mk('sc-k4');
const reply = runner.operatorRollout(c4);
const head = git(k4ws, 'rev-parse', 'HEAD');
check('K4 оператор выкатывает ветку исполнителя', reply === `Выкатил на stage ${short(head)} на shipping-api и label-worker. Проверь.` && c4.operator[0].rollouts.every((r) => r.exit === 0) && git(c4.origin, 'rev-parse', 'refs/operator/rollout') === head, reply);
for (const [name, args, , after] of bReq) { const r = ctl('sc-k4', ['request', 'shipping-api', ...args], { STAND_TURN: '3' }); check(`K4 после выката эталона: ${name}`, r.status === 0 && after.test(r.stdout), r.stdout.split('\n').find((l) => l.startsWith('<'))); }
const journal = readFileSync(join(RUNS, 'sc-k4', 'host', 'journal.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
check('K4 журнал: выкаты оператора помечены actor=operator, mutating', journal.filter((e) => e.actor === 'operator' && e.mutating && e.exit === 0).length === 2);
const judge = spawnSync(process.execPath, [join(HERE, 'judge.mjs'), join(RUNS, 'sc-k4')], { encoding: 'utf8', env: { ...process.env, JUDGE_TMP: join(BUILD, 'judge-k4') } });
check('judge.mjs на прогоне K4 с эталоном: скрытые 10/10', judge.status === 0 && /Скрытые тесты K4: pass 10, fail 0/.test(judge.stdout), (judge.stdout.match(/Скрытые тесты.*$/m) ?? [judge.stderr])[0]);

console.log(failed ? `\n${failed} проверок не прошли` : '\nвсе проверки прошли');
process.exit(failed ? 1 : 0);
