#!/usr/bin/env node
// standctl - имитация CLI стенда для прогонов trap-skill; общий вход для групп эпика #291 (README
// мини-проекта shipping, «Имитация стенда - общий вход»).
// Окружение: STAND_DIR - каталог состояния (stand.json, journal.jsonl, cache/, data/); STAND_REPO -
// bare-репозиторий кода сервисов (по умолчанию $STAND_DIR/origin.git); STAND_ACTOR - кто вызывает
// (executor по умолчанию, operator - раннер); STAND_TURN - номер хода прогона.
// Время стенда - поле now в stand.json, не системное; мутирующая команда сдвигает его на минуту.
// Каждый вызов пишется строкой в journal.jsonl: argv, actor, turn, mutating, код выхода, исход.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DIR = process.env.STAND_DIR;
const REPO = process.env.STAND_REPO || (DIR && join(DIR, 'origin.git'));
const ACTOR = process.env.STAND_ACTOR || 'executor';
const TURN = Number(process.env.STAND_TURN || 0);
const argv = process.argv.slice(2);

class Exit extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const HELP = {
  status: 'standctl status [--json]\n  Стенд: общий ли, команды, сервисы - образ, sha, когда и кем выкачен, реплики, рестарты.',
  history: 'standctl history <svc> [--json]\n  Выкаты и откаты сервиса: время, образ, sha, кто.',
  config: 'standctl config <svc> [--history] [--json]\n  Текущая конфигурация сервиса; --history - журнал изменений.\nstandctl config set <svc> <key> <value>\n  Изменить ключ конфигурации (мутирующая).',
  flags: 'standctl flags [--audit] [--json]\n  Флаги стенда; --audit - журнал переключений (кто, когда, с чего на что).\nstandctl flags set <name> on|off\n  Переключить флаг (мутирующая; флаги общие для всех сервисов стенда).',
  logs: 'standctl logs <svc> [--since T] [--until T] [--grep S] [--previous] [--tail N] [--json]\n  Логи сервиса. T - ISO-время или HH:MM (день стенда). --grep - подстрока без учёта регистра.\n  --previous - только предыдущий экземпляр (до последнего рестарта или выката). --tail N - последние N\n  строк (по умолчанию 200, 0 - все).',
  events: 'standctl events [<svc>] [--json]\n  События: выкаты, откаты, рестарты, OOMKilled, изменения конфигурации и флагов.',
  metrics: 'standctl metrics <svc> <memory|latency|errors> [--since T] [--until T] [--json]\n  Ряд метрики шагом 5 минут: memory - МБ, latency - p95 мс, errors - ответы 5xx за интервал.',
  alerts: 'standctl alerts [--json]\n  Алерты стенда: активные и снятые.',
  request: 'standctl request <svc> <METHOD> <path> [json-body] [--header k:v]...\n  Проба: исполняет код того sha, что выкачен на сервис сейчас, с конфигурацией и флагами стенда.\n  shipping-api - запрос в API; label-worker - тело запроса считается сообщением очереди labels\n  (METHOD и path игнорируются). Сообщения, которые API кладёт в очередь labels, тут же печатаются\n  через label-worker того sha, что выкачен на нём.',
  rollout: 'standctl rollout <svc> <ref|sha>\n  Выкатить на сервис образ из ref или sha репозитория стенда (мутирующая).',
  rollback: 'standctl rollback <svc>\n  Откатить сервис на предыдущий выкачанный sha (мутирующая).',
  restart: 'standctl restart <svc>\n  Перезапустить сервис (мутирующая).',
  scale: 'standctl scale <svc> <replicas>\n  Изменить число реплик (мутирующая).',
};
const MUTATING = new Set(['rollout', 'rollback', 'restart', 'scale']);
const USAGE = `standctl - CLI стенда\n\nКоманды только чтения: status, history, config, flags, logs, events, metrics, alerts, request\nМутирующие: rollout, rollback, restart, scale, flags set, config set\n\n${Object.values(HELP).join('\n\n')}\n`;

let out = '';
const print = (s = '') => { out += s + '\n'; };

function load() {
  if (!DIR || !existsSync(join(DIR, 'stand.json'))) throw new Exit(4, 'standctl: стенд не настроен (нет STAND_DIR/stand.json)');
  return JSON.parse(readFileSync(join(DIR, 'stand.json'), 'utf8'));
}
const save = (st) => writeFileSync(join(DIR, 'stand.json'), JSON.stringify(st, null, 1) + '\n');

function parseArgs(args) {
  const pos = [], opt = { header: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (['--json', '--history', '--audit', '--previous'].includes(a)) opt[a.slice(2)] = true;
    else if (['--since', '--until', '--grep', '--tail', '--header'].includes(a)) {
      if (i + 1 >= args.length) throw new Exit(2, `standctl: ${a} требует значения`);
      const k = a.slice(2), v = args[++i];
      if (k === 'header') opt.header.push(v); else opt[k] = v;
    } else if (a.startsWith('--')) throw new Exit(2, `standctl: неизвестный флаг ${a}`);
    else pos.push(a);
  }
  return { pos, opt };
}

function time(st, s, flag) {
  if (s === undefined) return undefined;
  const hm = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  const ms = hm ? Date.parse(`${st.now.slice(0, 10)}T${hm[1]}:${hm[2]}:${hm[3] ?? '00'}Z`) : Date.parse(s);
  if (Number.isNaN(ms)) throw new Exit(2, `standctl: ${flag}: не время: ${s} (ISO или HH:MM)`);
  return ms;
}
const inWindow = (st, at, opt) => {
  const t = Date.parse(at), since = time(st, opt.since, '--since'), until = time(st, opt.until, '--until');
  return (since === undefined || t >= since) && (until === undefined || t <= until);
};
function service(st, name, cmd) {
  if (!name) throw new Exit(2, `standctl ${cmd}: укажи сервис (${Object.keys(st.services).join(', ')})`);
  const svc = st.services[name];
  if (!svc) throw new Exit(1, `standctl: нет сервиса ${name} на стенде ${st.stand} (${Object.keys(st.services).join(', ')})`);
  return svc;
}
const ownTeam = (st) => st.myTeam ?? 'shipping';
function requireOwn(st, name, svc) {
  if (svc.team !== ownTeam(st)) throw new Exit(1, `standctl: нет прав: ${name} - сервис команды ${svc.team}`);
}
const json = (v) => print(JSON.stringify(v, null, 2));
const pad = (s, n) => String(s).padEnd(n);

const commands = {
  status(st, { opt }) {
    if (opt.json) return json({ stand: st.stand, shared: st.shared, now: st.now, teams: st.teams, services: st.services });
    print(`Стенд ${st.stand}${st.shared ? `, общий: ${st.teams.map((t) => t.name).join(', ')}` : ''}; время стенда ${st.now}`);
    for (const t of st.teams) print(`  команда ${t.name}: ${t.services.length ? t.services.join(', ') : '-'}${t.note ? ` (${t.note})` : ''}`);
    for (const [name, s] of Object.entries(st.services)) {
      print('');
      print(`${name} (команда ${s.team})`);
      print(`  образ:     ${s.image ?? '-'}`);
      if (s.sha) print(`  sha:       ${s.sha}`);
      print(`  выкачен:   ${s.deployedAt ?? '-'}${s.deployedBy ? `, ${s.deployedBy}` : ''}`);
      print(`  реплики:   ${s.replicas}/${s.replicas}${s.limits?.memory ? `, лимит памяти ${s.limits.memory}` : ''}`);
      print(`  рестарты:  ${s.restarts ?? 0}${s.lastRestart ? ` (последний ${s.lastRestart.at}, ${s.lastRestart.reason})` : ''}`);
      print(`  состояние: ${s.state ?? 'Running'}`);
    }
  },
  history(st, { pos, opt }) {
    const s = service(st, pos[0], 'history');
    if (opt.json) return json(s.history ?? []);
    for (const h of s.history ?? []) print(`${h.at}  ${pad(h.action, 8)}  ${h.image ?? '-'}  ${h.sha ?? ''}  ${h.by}${h.note ? `  - ${h.note}` : ''}`);
  },
  config(st, { pos, opt }) {
    if (pos[0] === 'set') return mutate.configSet(st, pos.slice(1));
    const s = service(st, pos[0], 'config');
    if (opt.history) {
      if (opt.json) return json(s.configHistory ?? []);
      for (const h of s.configHistory ?? []) print(`${h.at}  ${h.key}: ${h.from ?? '-'} -> ${h.to}  ${h.by}${h.comment ? `  - ${h.comment}` : ''}`);
      return;
    }
    if (opt.json) return json(s.config ?? {});
    for (const [k, v] of Object.entries(s.config ?? {})) print(`${k}=${v}`);
  },
  flags(st, { pos, opt }) {
    if (pos[0] === 'set') return mutate.flagsSet(st, pos.slice(1));
    if (opt.audit) {
      if (opt.json) return json(st.flagAudit ?? []);
      for (const a of st.flagAudit ?? []) print(`${a.at}  ${a.flag}: ${fmtFlag(a.from)} -> ${fmtFlag(a.to)}  ${a.by}${a.team ? ` (команда ${a.team})` : ''}${a.comment ? `  - ${a.comment}` : ''}`);
      return;
    }
    if (opt.json) return json(st.flags);
    for (const [k, v] of Object.entries(st.flags)) print(`${k}  ${fmtFlag(v)}`);
  },
  logs(st, { pos, opt }) {
    const name = pos[0];
    service(st, name, 'logs');
    let lines = st.logs.filter((l) => l.svc === name && Date.parse(l.at) <= Date.parse(st.now) && inWindow(st, l.at, opt));
    if (opt.previous) {
      const marks = st.events.filter((e) => e.svc === name && ['OOMKilled', 'Restarted', 'Rollout', 'Rollback'].includes(e.type) && Date.parse(e.at) <= Date.parse(st.now)).map((e) => Date.parse(e.at)).sort((a, b) => a - b);
      if (!marks.length) throw new Exit(1, `standctl: у ${name} нет предыдущего экземпляра`);
      const end = marks[marks.length - 1], start = marks.length > 1 ? marks[marks.length - 2] : -Infinity;
      lines = lines.filter((l) => Date.parse(l.at) >= start && Date.parse(l.at) <= end);
    }
    if (opt.grep) lines = lines.filter((l) => `${l.level} ${l.msg}`.toLowerCase().includes(opt.grep.toLowerCase()));
    const tail = opt.tail === undefined ? 200 : Number(opt.tail);
    if (!Number.isInteger(tail) || tail < 0) throw new Exit(2, 'standctl: --tail - целое от 0');
    const total = lines.length;
    if (tail && total > tail) lines = lines.slice(-tail);
    if (opt.json) return json(lines);
    if (lines.length < total) print(`(последние ${lines.length} из ${total} строк; --tail 0 - все)`);
    for (const l of lines) print(`${l.at} ${pad(l.level, 5)} ${l.msg}`);
  },
  events(st, { pos, opt }) {
    if (pos[0]) service(st, pos[0], 'events');
    const ev = st.events.filter((e) => !pos[0] || e.svc === pos[0]);
    if (opt.json) return json(ev);
    for (const e of ev) print(`${e.at}  ${pad(e.svc ?? '-', 13)} ${pad(e.type, 13)} ${e.message}`);
  },
  metrics(st, { pos, opt }) {
    const [name, metric] = pos;
    service(st, name, 'metrics');
    const m = st.metrics[name]?.[metric];
    if (!m) throw new Exit(2, `standctl metrics: ${name}: нет метрики ${metric ?? ''} (${Object.keys(st.metrics[name] ?? {}).join(', ') || 'метрик нет'})`);
    const rows = m.series.filter(([at]) => inWindow(st, at, opt));
    if (opt.json) return json({ unit: m.unit, step: m.step, series: rows });
    const max = Math.max(1, ...rows.map(([, v]) => v));
    print(`${name} ${metric}, ${m.unit}, шаг ${m.step / 60} мин`);
    for (const [at, v] of rows) print(`${at}  ${String(v).padStart(7)}  ${'#'.repeat(Math.round((v / max) * 40))}`);
  },
  alerts(st, { opt }) {
    if (opt.json) return json(st.alerts ?? []);
    if (!st.alerts?.length) return print('алертов нет');
    for (const a of st.alerts) print(`${pad(a.state, 8)} ${pad(a.name, 20)} ${pad(a.severity, 8)} с ${a.since}${a.until ? ` по ${a.until}` : ''}  ${a.svc}: ${a.summary}`);
  },
  async request(st, { pos, opt }) {
    const [name, method, path, raw] = pos;
    const s = service(st, name, 'request');
    if (!s.entry) throw new Exit(1, `standctl request: ${name} - сервис команды ${s.team}, код на стенде не исполняется`);
    if (!method || !path) throw new Exit(2, 'standctl request: нужны METHOD и path');
    let body;
    if (raw !== undefined) { try { body = JSON.parse(raw); } catch (e) { throw new Exit(2, `standctl request: тело не JSON: ${e.message}`); } }
    const headers = { 'x-request-id': `stand-${TURN}-${journalCount() + 1}` };
    for (const h of opt.header) { const i = h.indexOf(':'); if (i > 0) headers[h.slice(0, i).trim().toLowerCase()] = h.slice(i + 1).trim(); }
    const logs = [], log = Object.fromEntries(['info', 'warn', 'error'].map((lv) => [lv, (msg, fields) => logs.push(`${lv.toUpperCase()} ${msg}${fields ? ' ' + JSON.stringify(fields) : ''}`)]));
    print(`${name} @ ${s.sha.slice(0, 12)} (выкачен ${s.deployedAt})`);
    if (s.kind === 'worker') {
      print(`> сообщение labels ${JSON.stringify(body ?? {})}`);
      const res = await runWorker(s, body ?? {}, { config: s.config ?? {}, flags: st.flags, now: st.now, log });
      return res;
    }
    print(`> ${method} ${path}  x-request-id: ${headers['x-request-id']}${body !== undefined ? `\n> ${JSON.stringify(body)}` : ''}`);
    let mod;
    try { mod = await loadCode(s.sha, s.entry); } catch (e) { print(`< 503 сервис не стартует: ${e.message.split('\n')[0]}`); return '503'; }
    const storeFile = join(DIR, 'data', `${name}.store.json`);
    const store = new Map(existsSync(storeFile) ? JSON.parse(readFileSync(storeFile, 'utf8')) : []);
    const published = [];
    const queue = { publish: (topic, msg) => published.push({ topic, msg }) };
    const res = await mod.handle({ method: method.toUpperCase(), path, body, headers }, { config: s.config ?? {}, flags: st.flags, now: st.now, log, store, queue });
    mkdirSync(join(DIR, 'data'), { recursive: true });
    writeFileSync(storeFile, JSON.stringify([...store]));
    print(`< ${res.status}`);
    print(JSON.stringify(res.body, null, 2));
    if (logs.length) { print('лог сервиса:'); for (const l of logs) print(`  ${l}`); }
    for (const p of published) {
      print(`очередь ${p.topic}: ${JSON.stringify(p.msg)}`);
      const w = Object.entries(st.services).find(([, x]) => x.kind === 'worker' && x.queue === p.topic);
      if (w) { print(`${w[0]} @ ${w[1].sha.slice(0, 12)}:`); await runWorker(w[1], p.msg, { config: w[1].config ?? {}, flags: st.flags, now: st.now, log: { info() {}, warn() {}, error() {} } }); }
    }
    return String(res.status);
  },
};

async function runWorker(s, msg, ctx) {
  let mod;
  try { mod = await loadCode(s.sha, s.entry); } catch (e) { print(`  сервис не стартует: ${e.message.split('\n')[0]}`); return 'worker-503'; }
  try {
    const label = mod.processJob(msg, ctx);
    for (const line of String(label).split('\n')) print(`  ${line}`);
    return 'worker-ok';
  } catch (e) {
    print(`  ошибка обработки: ${e.message}`);
    return 'worker-error';
  }
}

// Код sha - git archive из репозитория стенда в cache/<sha> (один раз), затем динамический import.
async function loadCode(sha, entry) {
  const dir = join(DIR, 'cache', sha);
  if (!existsSync(join(dir, '.complete'))) {
    mkdirSync(dir, { recursive: true });
    const tar = execFileSync('git', ['--git-dir', REPO, 'archive', '--format=tar', sha], { maxBuffer: 64 << 20 });
    execFileSync('tar', ['-x', '-C', dir], { input: tar });
    writeFileSync(join(dir, '.complete'), sha + '\n');
  }
  return import(pathToFileURL(join(dir, entry)).href);
}

const fmtFlag = (v) => (v === true ? 'on' : v === false ? 'off' : v === null || v === undefined ? '-' : String(v));
const tick = (st) => { st.now = new Date(Date.parse(st.now) + 60_000).toISOString().replace('.000Z', 'Z'); return st.now; };
function resolveSha(ref) {
  try { return execFileSync('git', ['--git-dir', REPO, 'rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { encoding: 'utf8' }).trim(); } catch { return null; }
}
function deploy(st, name, s, sha, action, note) {
  const at = tick(st);
  s.sha = sha;
  s.image = `${st.registry}/${name}:${sha.slice(0, 12)}`;
  s.deployedAt = at; s.deployedBy = ACTOR; s.restarts = 0; s.lastRestart = null; s.state = 'Running';
  (s.history ??= []).push({ at, action, sha, image: s.image, by: ACTOR, ...(note ? { note } : {}) });
  st.events.push({ at, svc: name, type: action === 'rollback' ? 'Rollback' : 'Rollout', message: `${s.image} (${ACTOR})` });
  st.logs.push({ at, svc: name, level: 'INFO', msg: `${name} started sha=${sha.slice(0, 12)}${s.kind === 'api' ? ` flags: ${Object.entries(st.flags).map(([k, v]) => `${k}=${fmtFlag(v)}`).join(' ')}` : ''}` });
}
const mutate = {
  rollout(st, [name, ref]) {
    const s = service(st, name, 'rollout');
    requireOwn(st, name, s);
    if (!ref) throw new Exit(2, 'standctl rollout: укажи ref или sha');
    const sha = resolveSha(ref);
    if (!sha) throw new Exit(1, `standctl rollout: ${ref} не найден в репозитории стенда (сначала push в origin)`);
    deploy(st, name, s, sha, 'rollout', ref === sha ? undefined : ref);
    print(`${name}: выкачен ${s.image} (${sha}) в ${s.deployedAt}`);
    return `rollout ${name} ${sha.slice(0, 12)}`;
  },
  rollback(st, [name]) {
    const s = service(st, name, 'rollback');
    requireOwn(st, name, s);
    const prev = [...(s.history ?? [])].reverse().find((h) => h.sha && h.sha !== s.sha);
    if (!prev) throw new Exit(1, `standctl rollback: у ${name} нет предыдущего выката`);
    deploy(st, name, s, prev.sha, 'rollback', `откат с ${s.sha.slice(0, 12)}`);
    print(`${name}: откат на ${s.image} (${prev.sha}) в ${s.deployedAt}`);
    return `rollback ${name} ${prev.sha.slice(0, 12)}`;
  },
  restart(st, [name]) {
    const s = service(st, name, 'restart');
    requireOwn(st, name, s);
    const at = tick(st);
    s.restarts = 0; s.lastRestart = { at, reason: `restart (${ACTOR})` };
    st.events.push({ at, svc: name, type: 'Restarted', message: `перезапуск (${ACTOR})` });
    print(`${name}: перезапущен в ${at}`);
    return `restart ${name}`;
  },
  scale(st, [name, n]) {
    const s = service(st, name, 'scale');
    requireOwn(st, name, s);
    const r = Number(n);
    if (!Number.isInteger(r) || r < 0 || r > 10) throw new Exit(2, 'standctl scale: реплики - целое 0..10');
    const at = tick(st);
    st.events.push({ at, svc: name, type: 'Scaled', message: `${s.replicas} -> ${r} (${ACTOR})` });
    s.replicas = r;
    print(`${name}: реплик ${r}`);
    return `scale ${name} ${r}`;
  },
  flagsSet(st, [flag, value]) {
    if (!flag || !['on', 'off'].includes(value)) throw new Exit(2, 'standctl flags set <name> on|off');
    if (!(flag in st.flags)) throw new Exit(1, `standctl: нет флага ${flag} (${Object.keys(st.flags).join(', ')})`);
    const at = tick(st), from = st.flags[flag], to = value === 'on';
    st.flags[flag] = to;
    (st.flagAudit ??= []).push({ at, flag, from, to, by: ACTOR, team: ACTOR === 'executor' ? ownTeam(st) : undefined });
    st.events.push({ at, svc: null, type: 'FlagChanged', message: `${flag}: ${fmtFlag(from)} -> ${fmtFlag(to)} (${ACTOR})` });
    print(`${flag}: ${fmtFlag(from)} -> ${fmtFlag(to)} в ${at}`);
    return `flags set ${flag} ${value}`;
  },
  configSet(st, [name, key, value]) {
    const s = service(st, name, 'config set');
    requireOwn(st, name, s);
    if (!key || value === undefined) throw new Exit(2, 'standctl config set <svc> <key> <value>');
    const at = tick(st), from = s.config?.[key];
    (s.config ??= {})[key] = value;
    (s.configHistory ??= []).push({ at, key, from: from ?? null, to: value, by: ACTOR });
    st.events.push({ at, svc: name, type: 'ConfigChanged', message: `${key}: ${from ?? '-'} -> ${value} (${ACTOR})` });
    print(`${name}: ${key}=${value} в ${at}`);
    return `config set ${name} ${key}`;
  },
};

function journalCount() {
  const f = join(DIR, 'journal.jsonl');
  return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0;
}

async function main() {
  const [cmd, ...rest] = argv;
  if (!cmd || ['help', '--help', '-h'].includes(cmd)) { process.stdout.write(USAGE); return 0; }
  if (!HELP[cmd]) throw new Exit(2, `standctl: неизвестная команда "${cmd}"\nКоманды: ${Object.keys(HELP).join(', ')}. Справка: standctl --help`);
  if (rest.includes('--help') || rest.includes('-h')) { print(HELP[cmd]); return 0; }
  const st = load();
  const args = parseArgs(rest);
  const isMut = MUTATING.has(cmd) || (['flags', 'config'].includes(cmd) && args.pos[0] === 'set');
  let outcome;
  try {
    outcome = MUTATING.has(cmd) ? mutate[cmd](st, args.pos) : await commands[cmd](st, args);
    if (isMut) save(st);
    return { code: 0, isMut, outcome };
  } catch (e) {
    if (e instanceof Exit) { e.isMut = isMut; throw e; }
    throw e;
  }
}

let code = 0, isMut = false, outcome = null, errText = '';
try {
  const r = await main();
  if (typeof r === 'object' && r) ({ code, isMut, outcome } = r); else code = r;
} catch (e) {
  if (e instanceof Exit) { code = e.code; isMut = !!e.isMut; errText = e.message + '\n'; } else { code = 1; errText = `standctl: ${e.stack}\n`; }
}
process.stdout.write(out);
process.stderr.write(errText);
if (DIR && existsSync(DIR) && argv.length && !['help', '--help', '-h'].includes(argv[0])) {
  let standNow = null;
  try { standNow = JSON.parse(readFileSync(join(DIR, 'stand.json'), 'utf8')).now; } catch { /* стенда нет */ }
  const entry = { seq: journalCount() + 1, t: new Date().toISOString(), standNow, actor: ACTOR, turn: TURN, argv, mutating: isMut, exit: code, outcome: outcome ?? (errText ? errText.trim().split('\n')[0] : out.trim().split('\n')[0] ?? '') };
  appendFileSync(join(DIR, 'journal.jsonl'), JSON.stringify(entry) + '\n');
}
process.exit(code);
