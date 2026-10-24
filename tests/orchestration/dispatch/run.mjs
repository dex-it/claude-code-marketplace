#!/usr/bin/env node
// Грабли раздачи: главный поток со скиллом `subagent-dispatch` (arm skill) и без него (arm none) выполняет шесть работ экзамена способов (modes/), без пакета плана.
//
//   node run.mjs <каталог> --arm skill|none --model sonnet --effort high [--fork 0|1] [--budget 6]
//
// Дерево строит modes/gen.py (пакет плана удаляется), стрим пишется в <каталог>/stream.jsonl,
// оценка - grade.py.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

// Среда прогона изолирована от оператора (правило tests/README.md, «Среда прогона раннеров `claude -p`»): `--restricted`
// раннеру не подходит - ему нужны Bash и `bypassPermissions`, - поэтому источники настроек сужены до проекта, а MCP
// пользователя отрезаны. Плагины и скиллы подаются `--plugin-dir`. `OPERATOR_ENV=1` снимает изоляцию.
const ISOLATION = process.env.OPERATOR_ENV ? [] : ['--setting-sources', 'project', '--strict-mcp-config'];

const dir = resolve(process.argv[2] ?? '');
const armName = arg('arm', 'skill');
const model = arg('model', 'sonnet');
const effort = arg('effort', 'high');
const fork = arg('fork', '0');
const budget = arg('budget', '6');
if (!['skill', 'none'].includes(armName)) { console.error('--arm skill|none'); process.exit(2); }

const built = spawnSync('python3', ['-I', join(HERE, '../modes/gen.py'), dir], { encoding: 'utf8' });
if (built.status !== 0) { console.error(built.stderr); process.exit(2); }
rmSync(join(dir, 'pack'), { recursive: true, force: true });

const tasks = readFileSync(join(HERE, 'notes/tasks.txt'), 'utf8');
const lead = armName === 'skill' ? 'Используй скилл dex-skill-subagent-dispatch:subagent-dispatch.\n\n' : '';
const prompt = `${lead}${tasks}`;
const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
  '--permission-mode', 'bypassPermissions', '--max-budget-usd', budget, '--model', model, '--effort', effort, ...ISOLATION];
if (armName !== 'none') args.push('--plugin-dir', join(REPO, 'plugins/skills/dex-skill-subagent-dispatch'));
const r = spawnSync('claude', args, {
  cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 40 * 60 * 1000,
  env: { ...process.env, CLAUDE_CODE_FORK_SUBAGENT: fork },
});
writeFileSync(join(dir, 'stream.jsonl'), r.stdout ?? '');
const g = spawnSync('python3', ['-I', join(HERE, 'grade.py'), dir, '--arm', armName, '--orch', model, '--orch-effort', effort, '--fork', fork], { encoding: 'utf8' });
process.stdout.write(g.stdout || g.stderr);
