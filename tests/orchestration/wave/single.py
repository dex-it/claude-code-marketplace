#!/usr/bin/env python3
"""Плечо «одна сессия»: те же ТЗ одной сессией без dex-auto.

    python3 -I single.py <репо> --out <файл.json> [--model opus] [--effort medium] [--budget 12] [--skill | --do] [--stream]

`--skill` подключает скилл `subagent-dispatch` из рабочего дерева и называет его в поручении; `--do` подключает
тот же плагин и подаёт поручение командой полным именем `/dex-skill-subagent-dispatch:do`, не называя скилла:
в `claude -p` короткое `/do` не раскрывается и доходит до модели текстом.
`--stream` пишет стрим `claude -p` рядом с `--out` (`<out>.jsonl`): вызовы `Agent` и токены по моделям.
"""
import argparse, json, os, subprocess, time

# Среда прогона изолирована от оператора (tests/README.md, «Среда прогона раннеров `claude -p`»): `--restricted` раннеру не
# подходит - ему нужны Bash и `--dangerously-skip-permissions`, - поэтому источники настроек сужены до проекта, а MCP
# пользователя отрезаны. Плагины подаются `--plugin-dir`. `OPERATOR_ENV=1` снимает изоляцию.
ISOLATION = [] if os.environ.get('OPERATOR_ENV') else ['--setting-sources', 'project', '--strict-mcp-config']

ap = argparse.ArgumentParser()
ap.add_argument('repo'); ap.add_argument('--out', required=True)
ap.add_argument('--model', default='opus'); ap.add_argument('--budget', type=float, default=12)
ap.add_argument('--effort')
arm = ap.add_mutually_exclusive_group()
arm.add_argument('--skill', action='store_true'); arm.add_argument('--do', action='store_true')
ap.add_argument('--stream', action='store_true')
ap.add_argument('--prompt', default='Выполни все четыре добавления из TASK.md в этом репозитории. По завершении закоммить локально, push не делать.')
a = ap.parse_args()
lead = 'Используй скилл dex-skill-subagent-dispatch:subagent-dispatch.\n\n' if a.skill else ''
prompt = ('/dex-skill-subagent-dispatch:do ' if a.do else lead) + a.prompt
fmt = ['--output-format', 'stream-json', '--verbose'] if a.stream else ['--output-format', 'json']
args = ['claude', '-p', '--model', a.model, '--dangerously-skip-permissions', *fmt,
        '--max-budget-usd', str(a.budget), *ISOLATION]
if a.effort:
    args += ['--effort', a.effort]
if a.skill or a.do:
    plugin = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../plugins/skills/dex-skill-subagent-dispatch')
    args += ['--plugin-dir', os.path.normpath(plugin)]
t0 = time.time()
r = subprocess.run(args + [prompt], cwd=a.repo, text=True, capture_output=True, timeout=60 * 60,
                   env={k: v for k, v in os.environ.items() if k != 'CLAUDECODE'})
try:
    if a.stream:
        open(a.out + '.jsonl', 'w').write(r.stdout)
        data = [e for e in map(json.loads, filter(None, r.stdout.splitlines())) if e.get('type') == 'result'][-1]
    else:
        data = json.loads(r.stdout)
except (ValueError, IndexError):
    data = {'result': r.stdout[-2000:], 'parse_error': True}
data['_wall_s'] = round(time.time() - t0, 1)
json.dump(data, open(a.out, 'w'), ensure_ascii=False, indent=1)
print(json.dumps({'cost_usd': data.get('total_cost_usd'), 'wall_s': data['_wall_s'], 'turns': data.get('num_turns')}))
