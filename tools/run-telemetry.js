#!/usr/bin/env node
// Телеметрия прогона: токены главного потока и узлов трека. Метод, источники и грабли - tools/README.md.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { homedir } from 'node:os';

const PROJECTS = join(homedir(), '.claude', 'projects');

const USAGE = `node tools/run-telemetry.js [опции]
  --cwd <path>         последняя сессия проекта по его рабочему каталогу (дефолт - текущий)
  --session <id>       конкретная сессия, поиск по всем проектам
  --transcript <file>  транскрипт файлом
  --result <file>      JSON-вывод headless-прогона: ходы, длительность, стоимость
  --json               машинный вывод`;

function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a.startsWith('--') && argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else if (a.startsWith('--')) out[a.slice(2)] = true;
  }
  return out;
}

// Каталог проекта именуется путём, где не-буквенно-цифровые символы заменены дефисом.
function slugOf(cwd) {
  return resolve(cwd).replace(/[^a-zA-Z0-9]/g, '-');
}

function newestFile(dir, ext) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .map((f) => ({ f: join(dir, f), t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length ? files[0].f : null;
}

function readJsonl(path) {
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* обрезанная строка живого прогона */ }
  }
  return out;
}

const ZERO = { input: 0, output: 0, cache_read: 0, cache_creation: 0 };

function usageOf(u) {
  return {
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cache_read: u.cache_read_input_tokens || 0,
    cache_creation: u.cache_creation_input_tokens || 0,
  };
}

// Максимум по message.id, а не сумма: одно сообщение приходит несколькими записями со своей долей usage.
function aggregate(records) {
  const byId = new Map();
  const models = new Map();
  let turns = 0;
  let peak = 0;
  const tools = new Map();
  let first = null;
  let last = null;

  for (const r of records) {
    if (r.timestamp) {
      if (!first || r.timestamp < first) first = r.timestamp;
      if (!last || r.timestamp > last) last = r.timestamp;
    }
    const m = r.message;
    if (!m || r.type !== 'assistant') continue;
    if (Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === 'tool_use') tools.set(c.name, (tools.get(c.name) || 0) + 1);
      }
    }
    if (!m.usage) continue;
    const id = m.id || r.uuid;
    const u = usageOf(m.usage);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, u);
      turns++;
      if (m.model) models.set(m.model, (models.get(m.model) || 0) + 1);
    } else {
      for (const k of Object.keys(ZERO)) prev[k] = Math.max(prev[k], u[k]);
    }
    const ctx = u.input + u.cache_read + u.cache_creation;
    if (ctx > peak) peak = ctx;
  }

  const total = { ...ZERO };
  for (const u of byId.values()) for (const k of Object.keys(ZERO)) total[k] += u[k];
  total.all = total.input + total.output + total.cache_read + total.cache_creation;

  return {
    turns,
    peak_context: peak,
    tokens: total,
    models: [...models.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} (${n})`),
    tools: [...tools.entries()].sort((a, b) => b[1] - a[1]),
    first_ts: first,
    last_ts: last,
  };
}

// Узлы Workflow в транскрипт сессии не попадают - каждый пишется своим файлом рядом с ним.
function collectNodes(sessionDir) {
  const nodes = [];
  const wfRoot = join(sessionDir, 'subagents', 'workflows');
  if (!existsSync(wfRoot)) return nodes;
  for (const wf of readdirSync(wfRoot)) {
    const dir = join(wfRoot, wf);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.startsWith('agent-') || !f.endsWith('.jsonl')) continue;
      const metaPath = join(dir, f.replace(/\.jsonl$/, '.meta.json'));
      const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
      const agg = aggregate(readJsonl(join(dir, f)));
      nodes.push({
        workflow: wf,
        label: meta.description || basename(f, '.jsonl'),
        phase: meta.workflowPhase || '',
        agent_type: meta.agentType || '',
        ...agg,
      });
    }
  }
  return nodes.sort((a, b) => String(a.first_ts).localeCompare(String(b.first_ts)));
}

function seconds(a, b) {
  if (!a || !b) return null;
  return Math.round((Date.parse(b) - Date.parse(a)) / 1000);
}

function fmt(n) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return; }
  let transcript = args.transcript;
  let projectDir = null;

  if (!transcript) {
    if (args.session) {
      for (const p of readdirSync(PROJECTS)) {
        const cand = join(PROJECTS, p, `${args.session}.jsonl`);
        if (existsSync(cand)) { transcript = cand; projectDir = join(PROJECTS, p); break; }
      }
      if (!transcript) { console.error(`сессия ${args.session} не найдена в ${PROJECTS}`); process.exit(2); }
    } else {
      projectDir = join(PROJECTS, slugOf(args.cwd || process.cwd()));
      transcript = newestFile(projectDir, '.jsonl');
      if (!transcript) { console.error(`транскриптов нет: ${projectDir}`); process.exit(2); }
    }
  }
  if (!projectDir) projectDir = resolve(transcript, '..');

  const sessionId = basename(transcript, '.jsonl');
  const mainThread = aggregate(readJsonl(transcript));
  const nodes = collectNodes(join(projectDir, sessionId));

  const nodeTotal = { ...ZERO, all: 0 };
  for (const n of nodes) for (const k of Object.keys(nodeTotal)) nodeTotal[k] += n.tokens[k];

  const grand = mainThread.tokens.all + nodeTotal.all;
  const report = {
    session: sessionId,
    transcript,
    duration_s: seconds(mainThread.first_ts, mainThread.last_ts),
    main_thread: mainThread,
    nodes,
    totals: {
      main_thread: mainThread.tokens.all,
      nodes: nodeTotal.all,
      all: grand,
      nodes_share: grand ? +(nodeTotal.all / grand * 100).toFixed(1) : 0,
    },
  };

  if (args.result && existsSync(args.result)) {
    const r = JSON.parse(readFileSync(args.result, 'utf8'));
    report.headless = {
      subtype: r.subtype,
      num_turns: r.num_turns,
      duration_s: Math.round((r.duration_ms || 0) / 1000),
      total_cost_usd: r.total_cost_usd,
    };
  }

  if (args.json) { console.log(JSON.stringify(report, null, 2)); return; }

  console.log(`сессия ${sessionId}`);
  if (report.headless) {
    const h = report.headless;
    const cost = typeof h.total_cost_usd === 'number' ? h.total_cost_usd.toFixed(2) : h.total_cost_usd;
    console.log(`headless: ${h.subtype}, ходов ${h.num_turns}, ${h.duration_s} с, $${cost}`);
  }
  console.log(`длительность по транскрипту: ${report.duration_s ?? '-'} с\n`);

  const rows = [
    ['узел', 'модель', 'ходы', 'пик', 'токены'],
    ['главный поток', mainThread.models[0] || '-', String(mainThread.turns), fmt(mainThread.peak_context), fmt(mainThread.tokens.all)],
  ];
  for (const n of nodes) {
    rows.push([`${n.label}${n.phase ? ` [${n.phase}]` : ''}`, n.models[0] || '-', String(n.turns), fmt(n.peak_context), fmt(n.tokens.all)]);
  }
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  for (const [i, r] of rows.entries()) {
    console.log(r.map((c, j) => (j === 0 ? c.padEnd(w[j]) : c.padStart(w[j]))).join('  '));
    if (i === 0) console.log(w.map((x) => '-'.repeat(x)).join('  '));
  }

  console.log(`\nитого ${fmt(grand)}: главный поток ${fmt(mainThread.tokens.all)}, узлы ${fmt(nodeTotal.all)} (${report.totals.nodes_share}%)`);
  if (mainThread.tools.length) {
    console.log(`инструменты главного потока: ${mainThread.tools.slice(0, 8).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  }
  if (!nodes.length) console.log('узлов Workflow в сессии нет - либо прогон их не спавнил, либо каталог subagents/workflows пуст');
}

main();
