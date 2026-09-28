#!/usr/bin/env node
/**
 * Раннер исследования «вектор против решения»: headless-прогон `claude -p` на кейсе в одной ячейке
 * (форма пункта x модель x effort x поиск x подача). Образец - tools/run-activation.js.
 *
 * План - CSV с колонками id,case,form,model,effort,search,delivery (строит plan.mjs). id случайный:
 * по имени каталога прогона условие не читается. Таблица «id -> условие» лежит вне репозитория,
 * пока оценка не закончена.
 *
 * Прогон:
 *   ~/.cache/research/runs/<id>/work   копия входа кейса, `git init` + коммит; cwd исполнителя
 *   ~/.cache/research/runs/<id>/rules  SKILL.md редакции (подача path), каталог дан через --add-dir
 *   ~/.cache/research/runs/<id>/plugin плагин с редакцией (подача plugin), грузится --plugin-dir
 *   ~/.cache/research/runs/<id>/stream.jsonl  поток событий
 * В репозиторий (runs/<id>/) уходят meta.json, answer.md (последний текст ответа) и diff.patch.
 *
 * Изоляция: --restricted (нет Bash, файловые инструменты - только cwd и --add-dir, настройки
 * пользователя не читаются), --strict-mcp-config без MCP, явный --tools. Skill tool есть только в
 * подаче plugin; иначе --disable-slash-commands, чтобы облачные скиллы не попали в сессию.
 *
 * Использование:
 *   node run.mjs --plan ../results/plan-A.csv [--only id1,id2] [--parallel 2] [--dry]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH = resolve(HERE, '..');
const REPO = resolve(RESEARCH, '../../..');
const CACHE = join(homedir(), '.cache/research/runs');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const PLAN = arg('plan');
const ONLY = arg('only')?.split(',');
// Правило пользователя: не больше двух параллельных исполнителей.
const PARALLEL = Math.min(2, Number(arg('parallel', 2)));
const DRY = argv.includes('--dry');
const MAX_TURNS = Number(arg('max-turns', 80));

const MODELS = { sonnet: 'claude-sonnet-5', opus: 'claude-opus-5-5', haiku: 'claude-haiku-4-5' };

export function parseCsv(text) {
  const [head, ...rows] = text.trim().split('\n');
  const cols = head.split(',');
  return rows.filter(Boolean).map((r) => Object.fromEntries(r.split(',').map((v, i) => [cols[i], v])));
}

function loadCase(id) {
  return JSON.parse(readFileSync(join(HERE, 'cases', `${id}.json`), 'utf8'));
}

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

// Промпт собирается из шаблона рода кейса (code / review) и трёх вставок: строка скилла (только path),
// строка предписания поиска (только search=prescribed) и поручение кейса.
function buildPrompt(kase, row, dirs) {
  const tpl = readFileSync(join(HERE, 'prompts', `${kase.kind}.md`), 'utf8');
  const withSkill = row.form !== 'F0';
  const role = withSkill ? JSON.parse(readFileSync(join(HERE, 'forms', kase.skill, 'meta.json'), 'utf8')).role : '';
  const skillLine = withSkill && row.delivery === 'path'
    ? `Перед работой прочитай ${join(dirs.rules, 'SKILL.md')} - ${role}.\n`
    : '';
  const searchLine = row.search === 'prescribed'
    ? 'Поведение и дефолты библиотек, на которые опирается решение, сверь с документацией версии из манифеста проекта (WebSearch/WebFetch).\n'
    : '';
  const outside = withSkill && row.delivery === 'path' ? ', кроме названного SKILL.md' : '';
  return fill(tpl, {
    DIR: dirs.work, PROJECT: kase.project, SKILL_LINE: skillLine, SEARCH_LINE: searchLine,
    TASK: kase.task ?? '', OUTSIDE: outside,
  });
}

function prepare(row, kase) {
  const root = join(CACHE, row.id);
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  const dirs = { root, work: join(root, 'work'), rules: join(root, 'rules'), plugin: join(root, 'plugin') };
  mkdirSync(dirs.work, { recursive: true });
  for (const src of kase.inputs) {
    const from = join(REPO, src.from);
    cpSync(from, join(dirs.work, src.to ?? ''), { recursive: true });
  }
  execFileSync('git', ['init', '-q'], { cwd: dirs.work });
  execFileSync('git', ['add', '-A'], { cwd: dirs.work });
  execFileSync('git', ['-c', 'user.name=bench', '-c', 'user.email=bench@local', 'commit', '-qm', 'input'], { cwd: dirs.work });

  if (row.form !== 'F0') {
    const body = readFileSync(join(HERE, 'forms', kase.skill, `${row.form}.md`), 'utf8');
    if (row.delivery === 'path') {
      mkdirSync(dirs.rules, { recursive: true });
      writeFileSync(join(dirs.rules, 'SKILL.md'), body);
    } else {
      // Плагин с одной редакцией: имя и description - как у скилла каталога, тело - редакция формы.
      const meta = JSON.parse(readFileSync(join(HERE, 'forms', kase.skill, 'meta.json'), 'utf8'));
      const sk = join(dirs.plugin, 'skills', meta.name);
      mkdirSync(join(dirs.plugin, '.claude-plugin'), { recursive: true });
      mkdirSync(sk, { recursive: true });
      writeFileSync(join(dirs.plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: meta.plugin, version: '0.0.0-bench', description: meta.description }, null, 2));
      writeFileSync(join(sk, 'SKILL.md'), `---\nname: ${meta.name}\ndescription: ${JSON.stringify(meta.description)}\n---\n\n${body}`);
    }
  }
  return dirs;
}

function args(row, kase, dirs, prompt) {
  const tools = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];
  const a = [
    '-p', prompt,
    '--output-format', 'stream-json', '--verbose',
    '--model', MODELS[row.model] ?? row.model,
    '--effort', row.effort,
    '--max-turns', String(MAX_TURNS),
    '--restricted', '--strict-mcp-config', '--no-session-persistence',
    '--permission-mode', 'acceptEdits',
  ];
  if (row.form !== 'F0' && row.delivery === 'plugin') {
    tools.push('Skill');
    a.push('--plugin-dir', dirs.plugin);
  } else {
    a.push('--disable-slash-commands');
  }
  if (row.form !== 'F0' && row.delivery === 'path') a.push('--add-dir', dirs.rules);
  a.push('--tools', tools.join(','), '--allowed-tools', tools.join(','));
  return a;
}

function runOne(row) {
  const kase = loadCase(row.case);
  const dirs = prepare(row, kase);
  const prompt = buildPrompt(kase, row, dirs);
  const a = args(row, kase, dirs, prompt);
  writeFileSync(join(dirs.root, 'prompt.txt'), prompt);
  writeFileSync(join(dirs.root, 'argv.json'), JSON.stringify(a.map((x) => (x === prompt ? '<prompt.txt>' : x)), null, 2));
  if (DRY) { console.log(`[dry] ${row.id}`); return Promise.resolve(); }

  const started = new Date();
  return new Promise((done) => {
    const child = spawn('claude', a, { cwd: dirs.work, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [];
    let err = '';
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => {
      const raw = Buffer.concat(out).toString();
      writeFileSync(join(dirs.root, 'stream.jsonl'), raw);
      const meta = summarize(raw, { row, code, err, started, finished: new Date(), dirs });
      const dest = join(RESEARCH, 'runs', row.id);
      mkdirSync(dest, { recursive: true });
      // case.txt - не условие: судье кейс нужен, форма и модель - нет.
      writeFileSync(join(dest, 'case.txt'), row.case + '\n');
      writeFileSync(join(dest, 'answer.md'), meta.answer ?? '');
      delete meta.answer;
      writeFileSync(join(dest, 'meta.json'), JSON.stringify(meta, null, 2));
      // Diff входа против выхода: код, который оценивается, а не пересказ в ответе.
      execFileSync('git', ['add', '-A'], { cwd: dirs.work });
      const diff = execFileSync('git', ['diff', '--cached', 'HEAD'], { cwd: dirs.work, maxBuffer: 64 << 20 }).toString();
      writeFileSync(join(dest, 'diff.patch'), diff);
      console.log(`${row.id} exit=${code} turns=${meta.numTurns} in=${meta.usage?.input_tokens} out=${meta.usage?.output_tokens} web=${meta.webCalls} skills=${meta.skillCalls.join('|') || '-'}`);
      done();
    });
  });
}

// meta.json - из событий потока: init (модель, скиллы, плагины, инструменты), tool_use по именам,
// result (usage, стоимость, длительность, число ходов).
export function summarize(raw, { row, code, err, started, finished }) {
  const meta = {
    id: row.id, exitCode: code, started: started.toISOString(), finished: finished.toISOString(),
    wallMs: finished - started, init: null, toolCalls: {}, webCalls: 0, skillCalls: [], readPaths: [],
    usage: null, costUsd: null, durationMs: null, numTurns: null, isError: null, stderr: err.slice(-2000),
  };
  let lastText = '';
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'system' && e.subtype === 'init') {
      meta.init = { model: e.model, skills: e.skills, plugins: e.plugins, tools: e.tools, mcpServers: e.mcp_servers, cwd: e.cwd, claudeCodeVersion: e.claude_code_version };
    }
    if (e.type === 'assistant') {
      for (const part of e.message?.content ?? []) {
        if (part.type === 'tool_use') {
          meta.toolCalls[part.name] = (meta.toolCalls[part.name] ?? 0) + 1;
          if (part.name === 'WebSearch' || part.name === 'WebFetch') meta.webCalls++;
          if (part.name === 'Skill') meta.skillCalls.push(part.input?.skill ?? '?');
          if (part.name === 'Read' && part.input?.file_path) meta.readPaths.push(part.input.file_path);
        }
        if (part.type === 'text') lastText = part.text;
      }
    }
    if (e.type === 'result') {
      meta.usage = e.usage; meta.costUsd = e.total_cost_usd; meta.durationMs = e.duration_ms;
      meta.numTurns = e.num_turns; meta.isError = e.is_error; meta.resultSubtype = e.subtype;
      if (typeof e.result === 'string' && e.result) lastText = e.result;
    }
  }
  meta.answer = lastText;
  return meta;
}

async function main() {
  if (!PLAN) { console.error('--plan <csv> обязателен'); process.exit(2); }
  let rows = parseCsv(readFileSync(resolve(PLAN), 'utf8'));
  if (ONLY) rows = rows.filter((r) => ONLY.includes(r.id));
  console.log(`прогонов: ${rows.length}, параллельно: ${PARALLEL}`);
  const queue = [...rows];
  const worker = async () => { while (queue.length) await runOne(queue.shift()); };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
