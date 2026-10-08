#!/usr/bin/env node
// Оснастка замеров для скиллов оркестрации. Предмет прогона - набор `tests/optimize-for-llm`:
// 13 независимых кейсов с дословным грейдером, поэтому качество меряется без судьи-модели.
//
//   node harness.mjs tree  <dir> [O-01 ...]                         собрать рабочее дерево
//   node harness.mjs bulk  <dir> --model M --effort E [--agent]     все кейсы одной сессией
//   node harness.mjs case  <dir> <O-xx> --model M --effort E        один кейс, одна сессия
//   node harness.mjs naive <dir>                                    наивная оркестрация Opus -> Sonnet без скиллов
//   node harness.mjs plan  <dir> [--force]                          планировщик на всех кейсах, пакет в <dir>/pack
//   node harness.mjs exec  <dir> [--model M --effort E]             исполнитель по <dir>/pack
//   node harness.mjs claude <dir> <prompt-file> [флаги claude -p]   произвольный прогон
//   node harness.mjs grade <dir> [O-01 ...]                         дословная половина + сводка
//
// Рабочее дерево строится вне репозитория (README набора: исполнитель не должен видеть кейсы).
// Результат каждого прогона - <dir>/run.json: стоимость, токены по моделям, длительность, спавны.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const INPUTS = join(REPO, 'tests/optimize-for-llm/inputs');
const GRADE = join(REPO, 'tests/optimize-for-llm/grade.mjs');
const PLUGINS = join(REPO, 'plugins/skills');

// id -> [файл правки, вход]; список снят с CASES в tests/optimize-for-llm/grade.mjs.
const CASES = {
  'O-01': ['c01/redis-cache-keys.md', 'in-01-trap-skill.md'],
  'O-02': ['c02/dependency-auditor.md', 'in-02-agent-phases.md'],
  'O-03': ['c03/dependency-auditor.md', 'in-02-agent-phases.md'],
  'O-04': ['c04/dependency-auditor.md', 'in-02-agent-phases.md'],
  'O-05': ['c05/pg-slow-query.md', 'in-03-description.md'],
  'O-06': ['c06/migration-writer.md', 'in-04b-migration-agent.md'],
  'O-07': ['c07/release-check.md', 'in-05-prose-order.md'],
  'O-08': ['c08/lock-ordering.md', 'in-06-dense.md'],
  'O-09': ['c09/idempotent-consumer.md', 'in-07-code-comments.md'],
  'O-10': ['c10/release-track.md', 'in-08b-release-track.md'],
  'O-11': ['c11/data-migration-track.md', 'in-09-conditional-skip.md'],
  'O-12': ['c12/scheduled-jobs-auditor.md', 'in-10-diverged-copies.md'],
  'O-13': ['c13/feature-flags.md', 'in-11-unfinished-unit.md'],
};
// Особые кейсы: companion-файлы лежат рядом как контекст и не правятся.
const SPECIAL = {
  'O-06': 'В этом кейсе правится migration-writer.md; PROJECT_RULES.md лежит рядом как контекст и не правится.',
  'O-10': 'В этом кейсе правится release-track.md; references/channel-registry.md - его дом, лежит рядом и не правится.',
};

const SKILL_PLUGINS = ['dex-skill-optimize-for-llm', 'dex-skill-norm-writing'];
const SKILL = 'dex-skill-optimize-for-llm:optimize-for-llm';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

function tree(dir, ids = Object.keys(CASES)) {
  for (const id of ids) {
    const [out, src] = CASES[id];
    const dest = join(dir, out);
    mkdirSync(dirname(dest), { recursive: true });
    let body = readFileSync(join(INPUTS, src), 'utf8');
    // O-04: тот же вход, но верхний тир; замена делает ведущий и в задании её не комментирует.
    if (id === 'O-04') body = body.replace(/^model: sonnet$/m, 'model: opus');
    writeFileSync(dest, body);
    if (id === 'O-06') cpSync(join(INPUTS, 'in-04a-project-rules.md'), join(dir, 'c06/PROJECT_RULES.md'));
    if (id === 'O-10') {
      mkdirSync(join(dir, 'c10/references'), { recursive: true });
      cpSync(join(INPUTS, 'in-08a-channel-registry.md'), join(dir, 'c10/references/channel-registry.md'));
    }
  }
}

function casePrompt(id) {
  const [out] = CASES[id];
  const file = out.split('/').pop();
  const dirName = out.split('/')[0];
  const extra = SPECIAL[id] ? ` ${SPECIAL[id]}` : '';
  return `Прогони \`${SKILL}\` на файле ${dirName}/${file}, перепиши файл на месте и положи отчёт по форме шага 7 скилла рядом, в ${dirName}/REPORT.md.${extra}`;
}

function bulkPrompt(ids) {
  const files = ids.map((id) => `- ${CASES[id][0]}`).join('\n');
  const special = ids.filter((id) => SPECIAL[id]).map((id) => `${CASES[id][0].split('/')[0]}: ${SPECIAL[id]}`).join('\n');
  return `В рабочей директории подпапки кейсов, в каждой по одному файлу правки:\n${files}\n\n` +
    `Для каждого кейса прогони \`${SKILL}\` на его файле, перепиши файл на месте и положи отчёт по форме шага 7 скилла ` +
    `рядом, в REPORT.md той же подпапки. Кейсы независимы друг от друга.\n${special}\n\n` +
    `Когда все кейсы сделаны, напиши краткий итог.`;
}

function pluginFlags(extra = []) {
  const names = [...SKILL_PLUGINS, ...extra];
  return names.flatMap((n) => ['--plugin-dir', join(PLUGINS, n)]);
}

function runClaude(dir, prompt, { model, effort, agent, budget = 6, extraFlags = [], plugins = [], stream = false }) {
  mkdirSync(dir, { recursive: true });
  const args = ['-p', prompt, '--output-format', stream ? 'stream-json' : 'json', ...(stream ? ['--verbose'] : []), '--no-session-persistence',
    '--permission-mode', 'bypassPermissions', '--max-budget-usd', String(budget), ...pluginFlags(plugins)];
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
  if (!agent) args.push('--disallowedTools', 'Agent');
  args.push(...extraFlags);
  const t0 = Date.now();
  const r = spawnSync('claude', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 55 * 60 * 1000 });
  const wall = Date.now() - t0;
  let res = null;
  let calls = [];
  if (stream) {
    writeFileSync(join(dir, 'stream.jsonl'), r.stdout);
    for (const l of r.stdout.split('\n')) {
      let d; try { d = JSON.parse(l); } catch { continue; }
      if (d.type === 'result') res = d;
      if (d.type === 'assistant') for (const b of d.message.content) if (b.type === 'tool_use' && b.name === 'Agent') calls.push({ model: b.input.model, effort: b.input.effort, description: b.input.description });
    }
  } else {
    try { res = JSON.parse(r.stdout); } catch { /* ниже */ }
  }
  const summary = res ? {
    model: model ?? null, effort: effort ?? null, agent: !!agent, wall_ms: wall,
    cost_usd: res.total_cost_usd, turns: res.num_turns, duration_ms: res.duration_ms,
    is_error: res.is_error, stop: res.terminal_reason,
    by_model: Object.fromEntries(Object.entries(res.modelUsage ?? {}).map(([k, v]) => [k, {
      cost_usd: v.costUSD, input: v.inputTokens, output: v.outputTokens,
      cache_read: v.cacheReadInputTokens, cache_write: v.cacheCreationInputTokens, thinking: v.thinkingTokens }])),
    subagents: res.subagent_stats ? { spawned: res.subagent_stats.spawned, failed: res.subagent_stats.failed, max_depth: res.subagent_stats.max_depth } : null,
    agent_calls: calls,
    result_head: String(res.result ?? '').slice(0, 600),
  } : { error: 'no-json', wall_ms: wall, status: r.status, stderr: String(r.stderr).slice(0, 800), stdout: String(r.stdout).slice(0, 800) };
  writeFileSync(join(dir, 'run.json'), JSON.stringify(summary, null, 2));
  return summary;
}

function grade(dir, ids) {
  const r = spawnSync('node', [GRADE, dir, ...ids], { encoding: 'utf8' });
  const lines = r.stdout.split('\n');
  const per = {};
  for (const l of lines) {
    const m = l.match(/^(ok|ПРОВАЛ)\s+(O-\d+)\s+тело ([+-]?\d+) симв\., поле ([+-]?\d+) симв\./);
    if (m) per[m[2]] = { ok: m[1] === 'ok', body: +m[3], front: +m[4] };
  }
  const reports = Object.fromEntries(Object.keys(CASES).filter((id) => !ids.length || ids.includes(id)).map((id) => [id, existsSync(join(dir, id === 'O-01' ? 'c01' : CASES[id][0].split('/')[0], 'REPORT.md'))]));
  writeFileSync(join(dir, 'grade.txt'), r.stdout + r.stderr);
  return { passed: Object.values(per).filter((x) => x.ok).length, total: Object.keys(per).length, per, reports, code: r.status };
}

const [cmd, dirArg, ...rest] = process.argv.slice(2);
const dir = dirArg ? resolve(dirArg) : null;
const modelArg = arg('model');
const effortArg = arg('effort');
const budgetArg = Number(arg('budget', '6'));

if (cmd === 'tree') {
  const ids = rest.filter((x) => /^O-\d+$/.test(x));
  tree(dir, ids.length ? ids : undefined);
} else if (cmd === 'bulk') {
  const ids = (arg('cases') ? arg('cases').split(',') : Object.keys(CASES));
  tree(dir, ids);
  const s = runClaude(dir, bulkPrompt(ids), { model: modelArg, effort: effortArg, agent: flag('agent'), budget: budgetArg });
  const g = grade(dir, ids);
  console.log(JSON.stringify({ run: s, grade: { passed: g.passed, total: g.total } }, null, 2));
} else if (cmd === 'case') {
  const id = rest.find((x) => /^O-\d+$/.test(x));
  tree(dir, [id]);
  const s = runClaude(dir, casePrompt(id), { model: modelArg, effort: effortArg, agent: flag('agent'), budget: budgetArg });
  const g = grade(dir, [id]);
  console.log(JSON.stringify({ id, run: { cost_usd: s.cost_usd, wall_ms: s.wall_ms, error: s.error }, ok: g.per[id]?.ok ?? false, delta: g.per[id] }));
} else if (cmd === 'claude') {
  const promptFile = rest[0];
  const prompt = readFileSync(resolve(promptFile), 'utf8');
  const extraFlags = rest.slice(1).filter((x) => x !== '--agent');
  const plugins = (arg('plugins') ? arg('plugins').split(',') : []);
  const s = runClaude(dir, prompt, { model: modelArg, effort: effortArg, agent: flag('agent'), budget: budgetArg, plugins, extraFlags: extraFlags.filter((x, i, a) => !['--model', '--effort', '--budget', '--plugins'].includes(x) && !['--model', '--effort', '--budget', '--plugins'].includes(a[i - 1])) });
  console.log(JSON.stringify(s, null, 2));
} else if (cmd === 'naive') {
  // Наивная оркестрация: тот же запрос, но с просьбой раздать кейсы субагентам Sonnet; без скиллов.
  const ids = Object.keys(CASES);
  tree(dir, ids);
  const suffix = '\n\nРаздай кейсы субагентам (инструмент Agent), модель sonnet; одновременно не больше двух. Сам файлы кейсов не правь.';
  const s = runClaude(dir, bulkPrompt(ids) + suffix, { model: modelArg ?? 'opus', effort: effortArg ?? 'medium', agent: true, budget: budgetArg, stream: true });
  const g = grade(dir, ids);
  console.log(JSON.stringify({ run: s, grade: { passed: g.passed, total: g.total } }, null, 2));
} else if (cmd === 'plan') {
  // Планировщик на предмете optimize-for-llm и тринадцати кейсах. --force: оркестрировать вопреки признакам.
  const ids = Object.keys(CASES);
  tree(dir, ids);
  const force = flag('force') ? ' Оркестрировать вопреки признакам: это проверка исполнения пакета, вердикт orchestrate.' : '';
  const prompt = `Используй скилл orchestration-planner. Предмет: скилл \`${SKILL}\`. Задача пользователя:\n\n${bulkPrompt(ids)}\n\nПакет плана положи в ./pack. Лимит параллельных исполнителей 2.${force}`;
  const s = runClaude(dir, prompt, { model: modelArg ?? 'opus', effort: effortArg ?? 'xhigh', agent: false, budget: budgetArg, plugins: ['dex-skill-orchestration-planner', 'dex-skill-orchestration-executor'] });
  console.log(JSON.stringify(s, null, 2));
} else if (cmd === 'exec') {
  // Исполнитель по готовому пакету в <dir>/pack; дерево кейсов уже построено командой plan.
  const s = runClaude(dir, 'Используй скилл orchestration-executor: выполни пакет плана в ./pack.', { model: modelArg ?? 'opus', effort: effortArg ?? 'medium', agent: true, budget: budgetArg, stream: true, plugins: ['dex-skill-orchestration-executor'] });
  const g = grade(dir, Object.keys(CASES));
  console.log(JSON.stringify({ run: s, grade: { passed: g.passed, total: g.total } }, null, 2));
} else if (cmd === 'grade') {
  const ids = rest.filter((x) => /^O-\d+$/.test(x));
  const g = grade(dir, ids);
  console.log(JSON.stringify(g, null, 2));
} else if (cmd === 'prompt') {
  console.log(rest[0] ? casePrompt(rest[0]) : bulkPrompt(Object.keys(CASES)));
} else {
  console.error('команда: tree | bulk | case | naive | plan | exec | claude | grade | prompt');
  process.exit(2);
}
