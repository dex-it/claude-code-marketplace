#!/usr/bin/env node
// Экзамен способов работы: оркестратор по скиллу `orchestration-executor` выбирает, делать задачу самому,
// отдать свежему субагенту или форку.
//
//   node run.mjs <каталог> --set exam|fork --model haiku|sonnet|opus --effort E [--fork 0|1] [--budget 6]
//
// Каталог строится заново (gen.py), прогон - `claude -p` с одним скиллом-исполнителем, стрим пишется в
// <каталог>/stream.jsonl, оценка - grade.py. Режим форков задаётся CLAUDE_CODE_FORK_SUBAGENT (в `claude -p`
// по умолчанию выключен).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };

const dir = resolve(process.argv[2] ?? '');
const set = arg('set', 'exam');
const model = arg('model', 'sonnet');
const effort = arg('effort', 'high');
const fork = arg('fork', '1');
const budget = arg('budget', '6');
if (!['exam', 'fork'].includes(set)) { console.error('--set exam|fork'); process.exit(2); }

const built = spawnSync('python3', ['-I', join(HERE, 'gen.py'), dir], { encoding: 'utf8' });
if (built.status !== 0) { console.error(built.stderr); process.exit(2); }

const notes = readFileSync(join(HERE, 'notes', `${set}.txt`), 'utf8');
const prompt = `Используй скилл orchestration-executor: выполни пакет плана в ./pack.\n\n${notes}`;
const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
  '--permission-mode', 'bypassPermissions', '--max-budget-usd', budget,
  '--plugin-dir', join(REPO, 'plugins/skills/dex-skill-orchestration-executor'),
  '--model', model, '--effort', effort];
const r = spawnSync('claude', args, {
  cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, timeout: 40 * 60 * 1000,
  env: { ...process.env, CLAUDE_CODE_FORK_SUBAGENT: fork },
});
writeFileSync(join(dir, 'stream.jsonl'), r.stdout ?? '');
const g = spawnSync('python3', ['-I', join(HERE, 'grade.py'), dir, '--set', set, '--orch', model, '--fork', fork], { encoding: 'utf8' });
process.stdout.write(g.stdout || g.stderr);
