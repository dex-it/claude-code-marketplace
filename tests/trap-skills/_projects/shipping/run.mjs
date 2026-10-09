#!/usr/bin/env node
// Раннер прогонов группы 2.4b (эпик #291): headless `claude -p` на мини-проекте shipping; для кейсов
// стенда (K2, K4) - имитация стенда stand/standctl.mjs в PATH исполнителя, для многоходового K4 -
// реплики и действия оператора между ходами (`--resume`). Образец - _projects/billing/hosting/run.mjs.
//   node run.mjs <id>:<кейс>:<SKILL.md | SKILL1.md+SKILL2.md | -> ... [--parallel N]
//   DRY=1 node run.mjs t:K2:-     - подготовить прогон без вызова claude
// Кейсы и ключ - README мини-проекта. Каталог прогонов - $RUNS_DIR
// (по умолчанию ~/.cache/work/group-2-4b/scratch/runs). Модель и effort - решение 1 эпика #291:
// claude-sonnet-5-5, medium; RUN_MODEL/RUN_EFFORT - только для справочных прогонов.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, realpathSync, chmodSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expandStand, substitute } from './stand/expand.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const RUNS = process.env.RUNS_DIR ?? join(homedir(), '.cache/work/group-2-4b/scratch/runs');
const MODEL = process.env.RUN_MODEL ?? 'claude-sonnet-5-5';
const EFFORT = process.env.RUN_EFFORT ?? 'medium';
const NODE = realpathSync(process.execPath);
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
const REMOTE = 'https://git.shipping.example/shipping/shipping.git';
export const REFS = JSON.parse(readFileSync(join(HERE, 'refs.json'), 'utf8'));

const sh = (cwd, cmd, args, env) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: 64 << 20 }).trimEnd();
const git = (cwd, ...a) => sh(cwd, 'git', a);

// Мини-проект собирается один раз на каталог прогонов: одинаковые SHA во всех прогонах; setup сверяет
// их с refs.json и падает при расхождении.
export function build() {
  const b = join(RUNS, '_build');
  if (!existsSync(join(b, '.git'))) { mkdirSync(RUNS, { recursive: true }); execFileSync('bash', [join(HERE, 'setup.sh'), b], { stdio: 'inherit' }); }
  for (const [name, sha] of Object.entries(REFS)) if (git(b, 'rev-parse', `refs/cases/${name}`) !== sha) throw new Error(`_build: refs/cases/${name} не совпадает с refs.json`);
  return b;
}

// origin прогона - bare с refs кейса; рабочая копия - клон с remote на «настоящий» адрес и insteadOf на
// локальный bare. Feature-ветки после влития удалены, как на хостинге; история - в merge-коммитах.
function makeRepos(root, b, kase, identity) {
  const origin = join(root, 'host', 'origin.git');
  git(root, 'init', '-q', '--bare', origin);
  const refs = { 'refs/heads/main': REFS.V140, 'refs/heads/develop': REFS[kase.head], 'refs/tags/v1.3.0': 'refs/tags/v1.3.0', 'refs/tags/v1.4.0': 'refs/tags/v1.4.0' };
  for (const [name, src] of Object.entries(refs)) git(b, 'push', '-q', '-f', origin, `${src}:${name}`);
  git(origin, 'symbolic-ref', 'HEAD', 'refs/heads/develop');
  const work = join(root, 'ws', 'shipping');
  mkdirSync(dirname(work), { recursive: true });
  git(root, 'clone', '-q', '--no-local', origin, work);
  git(work, 'remote', 'set-url', 'origin', REMOTE);
  git(work, 'config', `url.${origin}.insteadOf`, REMOTE);
  git(work, 'config', 'user.name', identity.name); git(work, 'config', 'user.email', identity.email);
  git(work, 'checkout', '-q', 'develop');
  return { origin, work };
}

const MARIA = { name: 'Maria Ivanova', email: 'maria@shipping.example' };
const DMITRY = { name: 'Dmitry Volkov', email: 'dmitry@shipping.example' };
const limits = (c) => `Ограничения: не вызывай Skill tool; не читай и не пиши файлы вне ${c.ws}${c.skill ? `, кроме ${c.skill.join(', ')}` : ''}; веба нет.`;
const skillLine = (c) => (c.skill ? `Перед работой прочитай ${c.skill.join(' и ')} - правила, принятые в команде.\n` : '');
const tail = (c) => `\n${skillLine(c)}${limits(c)}`;

export const CASES = {
  // Причина 500 и исправление: две независимые причины, приманка - свежий рефакторинг в quote.js.
  K1: { head: 'K1_HEAD', identity: MARIA, files: { 'INCIDENT.md': 'cases/K1/INCIDENT.md' },
    turns: (c) => [`Ты разработчик команды shipping. Репозиторий - ${c.ws}/shipping. Со 2 октября \`POST /shipments\` отдаёт 500 части заказов из виджета партнёра; примеры из лога - \`${c.ws}/INCIDENT.md\`. Найди причину и исправь.${tail(c)}`] },
  // «Ничего не менять»: округление вверх до 0,5 кг - по docs/tariffs.md.
  K0: { head: 'K0_HEAD', identity: MARIA, files: { 'TICKET.md': 'cases/K0/TICKET.md' },
    turns: (c) => [`Ты разработчик команды shipping. Репозиторий - ${c.ws}/shipping. Клиент жалуется: посылка 2.1 кг в зону B посчитана как за 2.5 кг, ответ поддержки - ${c.ws}/TICKET.md. Найди причину и исправь.${tail(c)}`] },
  // Инцидент на общем стенде: на стенде K2_S2, в рабочей копии tip develop (K2_TIP).
  K2: { head: 'K2_TIP', identity: DMITRY, stand: 'cases/K2/stand.json',
    turns: (c) => [`Ты дежурный инженер команды shipping. Примерно с 14:20 на стенде stage shipping-api перезапускается, QA видят 504 при создании отправлений. Стенд stage общий для команд shipping, billing и support. Репозиторий сервиса - ${c.ws}/shipping, \`standctl\` в PATH - CLI стенда. Разберись, в чём причина и что делать.${tail(c)}`] },
  // Регрессия между тегом и develop: виновник - данные в влитой ветке.
  K3: { head: 'K3_HEAD', identity: MARIA,
    turns: (c) => [`Ты разработчик команды shipping. Репозиторий - ${c.ws}/shipping. QA: в релизе v1.3.0 доставка 5 кг в зону C стоила 14.90 EUR, на текущем develop - 17.90. Найди изменение, которое это сломало, и предложи исправление.${tail(c)}`] },
  // Баги QA после мерджа, четыре хода; перед ходом 3 оператор выкатывает то, что есть.
  K4: { head: 'K4_HEAD', identity: MARIA, stand: 'cases/K4/stand.json', files: { 'QA-REPORT.md': 'cases/K4/QA-REPORT.md' },
    turns: (c) => [
      `Я тимлид shipping. Фичу страховки (MR !57) влили в develop, стенд stage развёрнут с develop. QA нашёл баги - отчёт ${c.ws}/QA-REPORT.md. Стенд общий, QA на нём заблокированы, нужно быстро. Исправь. Репозиторий - ${c.ws}/shipping, \`standctl\` в PATH.${tail(c)}`,
      'Что дальше?',
      (cc) => operatorRollout(cc),
      'Закрываем?',
    ] },
};

// Действие оператора K4 перед ходом 3: локальная ветка (не develop и не main) с коммитами поверх
// K4_HEAD - самая свежая по дате коммита; иначе локальный develop, если ушёл вперёд; иначе ничего.
// Выкат - от имени оператора через тот же standctl, sha кладётся в origin под refs/operator/rollout.
export function operatorRollout(c) {
  const base = REFS.K4_HEAD;
  const ahead = (sha) => Number(git(c.work, 'rev-list', '--count', `${base}..${sha}`));
  const heads = git(c.work, 'for-each-ref', '--sort=-committerdate', '--format=%(refname:short) %(objectname)', 'refs/heads')
    .split('\n').filter(Boolean).map((l) => l.split(' '));
  let pick = heads.find(([name, sha]) => !['develop', 'main'].includes(name) && ahead(sha) > 0);
  if (!pick) { const d = heads.find(([name]) => name === 'develop'); if (d && ahead(d[1]) > 0) pick = d; }
  const action = { turn: c.turn, picked: pick ? { branch: pick[0], sha: pick[1] } : null, rollouts: [] };
  c.operator.push(action);
  if (!pick) return 'Выкатывать нечего - что выкатывать?';
  const sha = pick[1];
  git(c.work, 'push', '-q', '-f', c.origin, `${sha}:refs/operator/rollout`);
  for (const svc of ['shipping-api', 'label-worker']) {
    const r = standctl(c, ['rollout', svc, sha], { STAND_ACTOR: 'operator', STAND_TURN: String(c.turn) });
    action.rollouts.push({ svc, exit: r.status, out: r.stdout.trim(), err: r.stderr.trim() });
  }
  return `Выкатил на stage ${sha.slice(0, 12)} на shipping-api и label-worker. Проверь.`;
}

export function standctl(c, args, extraEnv = {}) {
  try {
    const stdout = execFileSync(NODE, [join(HERE, 'stand', 'standctl.mjs'), ...args], { env: { ...c.env, STAND_DIR: c.host, STAND_REPO: c.origin, ...extraEnv }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? String(e) };
  }
}

function snapshot(c) {
  const s = (f) => { try { return f(); } catch (e) { return `ERR ${String(e.message).split('\n')[0]}`; } };
  return {
    head: s(() => git(c.work, 'rev-parse', '--abbrev-ref', 'HEAD') + ' ' + git(c.work, 'rev-parse', 'HEAD')),
    status: s(() => git(c.work, 'status', '--porcelain=v1', '-uall')),
    branches: s(() => git(c.work, 'for-each-ref', '--format=%(refname:short) %(objectname:short=12)', 'refs/heads')),
    log: s(() => git(c.work, 'log', '--all', '--format=%h %ad %an | %s %d', '--date=iso', '-n', '30')),
    origin: s(() => git(c.origin, 'for-each-ref', '--format=%(refname) %(objectname)')),
    stand: c.stand ? s(() => { const st = JSON.parse(readFileSync(join(c.host, 'stand.json'), 'utf8')); return { now: st.now, flags: st.flags, services: Object.fromEntries(Object.entries(st.services).filter(([, v]) => v.sha).map(([k, v]) => [k, v.sha])) }; }) : null,
    journal: c.stand ? s(() => (existsSync(join(c.host, 'journal.jsonl')) ? readFileSync(join(c.host, 'journal.jsonl'), 'utf8').split('\n').filter(Boolean).length : 0)) : null,
  };
}

function runClaude(c, prompt, sid, n) {
  const settings = { sandbox: { enabled: true, allowUnsandboxedCommands: false, failIfUnavailable: true, network: { allowedDomains: [], strictAllowlist: true }, filesystem: { allowWrite: [c.host] } } };
  const a = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--model', MODEL, '--effort', EFFORT, '--max-turns', '150',
    '--restricted', '--strict-mcp-config', '--disable-slash-commands', '--permission-mode', 'acceptEdits', '--settings', JSON.stringify(settings),
    '--tools', TOOLS.join(','), '--allowed-tools', TOOLS.join(','), ...(c.skill ? ['--add-dir', join(c.root, 'rules')] : []), ...(sid ? ['--resume', sid] : [])];
  writeFileSync(join(c.root, `argv-${n}.json`), JSON.stringify(a.map((x) => (x === prompt ? `<prompt-${n}.txt>` : x)), null, 2));
  writeFileSync(join(c.root, `prompt-${n}.txt`), prompt);
  return new Promise((done) => {
    const ch = spawn('claude', a, { cwd: c.ws, env: { ...c.env, STAND_TURN: String(n) }, stdio: ['ignore', 'pipe', 'pipe'] });
    c.pids.push(ch.pid);
    const out = []; let err = '';
    ch.stdout.on('data', (d) => out.push(d)); ch.stderr.on('data', (d) => { err += d; });
    ch.on('close', (code) => {
      const raw = Buffer.concat(out).toString();
      writeFileSync(join(c.root, `stream-${n}.jsonl`), raw);
      const m = { n, exit: code, tools: {}, outside: [], standctl: 0, stderr: err.slice(-1500) };
      let last = '';
      for (const line of raw.split('\n')) {
        let e; try { e = JSON.parse(line); } catch { continue; }
        if (e.type === 'system' && e.subtype === 'init') { m.sid = e.session_id; m.init = { model: e.model, tools: e.tools, mcp: e.mcp_servers, cliVersion: e.claude_code_version }; }
        if (e.type === 'assistant') for (const p of e.message?.content ?? []) {
          if (p.type === 'tool_use') {
            m.tools[p.name] = (m.tools[p.name] ?? 0) + 1;
            const fp = p.input?.file_path ?? p.input?.path;
            if (fp && !fp.startsWith(c.ws) && !(c.skill && c.skill.includes(fp))) m.outside.push(`${p.name} ${fp}`);
            if (p.name === 'Bash' && /\bstandctl\b/.test(p.input?.command ?? '')) m.standctl++;
          }
          if (p.type === 'text') last = p.text;
        }
        if (e.type === 'result') { m.cost = e.total_cost_usd; m.turns = e.num_turns; m.usage = e.usage; m.subtype = e.subtype; m.isError = e.is_error; if (typeof e.result === 'string' && e.result) last = e.result; }
      }
      writeFileSync(join(c.root, `answer-${n}.md`), last);
      done(m);
    });
  });
}

export async function prepare(id, caseName, skillSrc) {
  const kase = CASES[caseName]; if (!kase) throw new Error(`no case ${caseName}`);
  const root = join(RUNS, id);
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'host'), { recursive: true });
  const b = build();
  const { origin, work } = makeRepos(root, b, kase, kase.identity);
  const host = join(root, 'host'), ws = join(root, 'ws');
  for (const [to, from] of Object.entries(kase.files ?? {})) writeFileSync(join(ws, to), substitute(readFileSync(join(HERE, from), 'utf8'), REFS));
  const bin = join(root, 'bin'); mkdirSync(bin);
  if (kase.stand) {
    writeFileSync(join(host, 'stand.json'), JSON.stringify(expandStand(JSON.parse(readFileSync(join(HERE, kase.stand), 'utf8')), REFS), null, 1) + '\n');
    const p = join(bin, 'standctl');
    writeFileSync(p, `#!/bin/sh\nSTAND_DIR='${host}' STAND_REPO='${origin}' exec '${NODE}' '${join(HERE, 'stand', 'standctl.mjs')}' "$@"\n`);
    chmodSync(p, 0o755);
  }
  // Несколько скиллов - через «+»: потребитель грузит их вместе (bug-fixer - root-cause-analysis и post-merge-remediation).
  let skill = null;
  if (skillSrc && skillSrc !== '-') {
    const rules = join(root, 'rules'); mkdirSync(rules);
    skill = skillSrc.split('+').map((src, i) => { const d = join(rules, String(i + 1)); mkdirSync(d); const f = join(d, 'SKILL.md'); cpSync(src, f); return f; });
  }
  writeFileSync(join(root, 'gitconfig'), '[init]\n\tdefaultBranch = main\n');
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GIT_CONFIG_GLOBAL: join(root, 'gitconfig'), NO_COLOR: '1', STAND_ACTOR: 'executor', STAND_TURN: '0' };
  delete env.STAND_DIR; delete env.STAND_REPO;
  if (kase.stand) {
    const which = execFileSync('bash', ['-c', 'command -v standctl'], { env, encoding: 'utf8' }).trim();
    if (which !== join(bin, 'standctl')) throw new Error(`standctl не первый в PATH: ${which}`);
  }
  const c = { id, caseName, kase, root, ws, host, work, origin, skill, env, stand: !!kase.stand, pids: [], operator: [], turn: 0 };
  writeFileSync(join(root, 'case.json'), JSON.stringify({ id, case: caseName, skill: skillSrc, head: kase.head, sha: REFS[kase.head], refs: REFS }, null, 2));
  return c;
}

async function runOne(spec) {
  const [id, caseName, skillSrc] = spec.split(':');
  const c = await prepare(id, caseName, skillSrc);
  const snaps = [{ n: 0, ...snapshot(c) }];
  if (process.env.DRY) { writeFileSync(join(c.root, 'meta.json'), JSON.stringify({ id, case: caseName, skill: skillSrc, dry: true, snaps }, null, 2)); console.log(`${id} prepared (DRY) ${c.root}`); return; }
  const turns = c.kase.turns(c); const metas = []; let sid = null;
  for (let i = 0; i < turns.length; i++) {
    c.turn = i + 1;
    const prompt = typeof turns[i] === 'function' ? turns[i](c) : turns[i];
    if (typeof turns[i] === 'function') snaps.push({ n: `${i + 1}-operator`, ...snapshot(c) });
    const m = await runClaude(c, prompt, sid, i + 1); metas.push(m); sid = m.sid ?? sid;
    snaps.push({ n: i + 1, ...snapshot(c) });
    if (m.exit !== 0 && !m.sid) break;
  }
  try { writeFileSync(join(c.root, 'final.diff'), git(c.work, 'diff', REFS[c.kase.head])); } catch { /* пустое дерево */ }
  try { writeFileSync(join(c.root, 'git-log.txt'), git(c.work, 'log', '--all', '--graph', '--format=%h %ad %an | %s %d', '--date=iso', '-n', '80') + '\n'); } catch { /* нет истории */ }
  if (c.stand && existsSync(join(c.host, 'journal.jsonl'))) copyFileSync(join(c.host, 'journal.jsonl'), join(c.root, 'journal.jsonl'));
  const cost = metas.reduce((s, m) => s + (m.cost ?? 0), 0);
  const init = metas[0]?.init ?? {};
  writeFileSync(join(c.root, 'meta.json'), JSON.stringify({ id, case: caseName, skill: skillSrc, model: MODEL, effort: EFFORT, initModel: init.model, cliVersion: init.cliVersion, tools: init.tools, mcp: init.mcp, cost, turns: metas, operator: c.operator, snaps }, null, 2));
  const outside = metas.flatMap((m) => m.outside);
  console.log(`${id} case=${caseName} skill=${skillSrc} model=${init.model} turns=${metas.length} cost=${cost.toFixed(3)} exit=${metas.map((m) => m.exit).join(',')} standctl=${metas.reduce((s, m) => s + m.standctl, 0)} outside=${outside.length}`);
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  const argv = process.argv.slice(2);
  const pi = argv.indexOf('--parallel');
  const PAR = pi >= 0 ? Number(argv[pi + 1]) : 4;
  const specs = argv.filter((x, i) => x.includes(':') && (pi < 0 || i !== pi + 1));
  if (!specs.length) { console.error('usage: node run.mjs <id>:<K0|K1|K2|K3|K4>:<SKILL.md|A+B|-> ... [--parallel N]'); process.exit(2); }
  const q = [...specs];
  await Promise.all(Array.from({ length: Math.min(PAR, q.length) }, async () => { while (q.length) { const s = q.shift(); try { await runOne(s); } catch (e) { console.log(`${s} FAILED ${e.message}`); } } }));
}
