#!/usr/bin/env python3
"""Волна целей на треке `/auto` dex-auto: тонкий скрипт L3 лестницы режимов.

    python3 -I wave.py plan  <репо> --task TASK.md [--model opus] --out plan.json
    python3 -I wave.py run   <репо> --plan plan.json --out <каталог отчёта>
                              [--main-model sonnet] [--final-review] [--budget 10]

`plan` - один вызов сильной модели: граф целей (id, цель, критерий, граница, зависимости).
`run` - по уровням графа: у каждой цели ветка `auto/<id>` от интеграционной ветки `integration`, цель
записывается в ledger (`00-goal.md`), по цели - свой процесс `claude -p "/dex-auto:auto <id>"` параллельно;
исход читается из ledger; ветки со статусом `complete` вливаются в `integration` (конфликт - вызов
`claude -p` на разрешение), после уровня идёт `npm test`. Модель зовётся только на суждение: план,
исполнение цели, разрешение конфликта, финальное ревью.
"""
import argparse, json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
DEX_AUTO = os.environ.get('DEX_AUTO_DIR') or os.path.join(REPO_ROOT, 'plugins/auto/dex-auto')
SKILL_DIRS = [os.path.join(REPO_ROOT, 'plugins/skills', n) for n in ('dex-skill-stack-registry', 'dex-skill-requirement-quality')]
HOOKS = os.path.join(DEX_AUTO, 'hooks/scripts')
SLUG_BAD = re.compile(r'[^A-Za-z0-9-]')
# Среда прогона изолирована от оператора (tests/README.md, «Среда прогона раннеров `claude -p`»): `--restricted` раннеру не
# подходит - ему нужны Bash и `--dangerously-skip-permissions`, - поэтому источники настроек сужены до проекта, а MCP
# пользователя отрезаны. Плагины подаются `--plugin-dir`. `OPERATOR_ENV=1` снимает изоляцию.
ISOLATION = [] if os.environ.get('OPERATOR_ENV') else ['--setting-sources', 'project', '--strict-mcp-config']

PLAN_SCHEMA = {
    'type': 'object', 'required': ['tasks'],
    'properties': {'tasks': {'type': 'array', 'items': {
        'type': 'object', 'required': ['id', 'goal', 'done', 'boundary', 'deps'],
        'properties': {
            'id': {'type': 'string', 'description': 'F1, F2, ...'},
            'goal': {'type': 'string', 'description': 'цель фразой: что появляется и где'},
            'done': {'type': 'array', 'items': {'type': 'string'}, 'description': 'критерий «готово»: проверяемые пункты'},
            'boundary': {'type': 'array', 'items': {'type': 'string'}, 'description': 'чего не делаем'},
            'deps': {'type': 'array', 'items': {'type': 'string'}, 'description': 'id целей, чей код нужен этой'},
        }}}},
}

PLAN_PROMPT = """Ты планировщик. Ниже ТЗ на работу в репозитории. Раздели её на цели для автономного исполнителя
(по цели - один прогон трека feature в отдельном git-дереве и ветке; результат - локальные коммиты).

Правила: цель - отдельная проверяемая единица; две цели независимы, если не требуют кода друг друга (общие файлы,
которые обе только дополняют, зависимостью не считаются - ветки сольются после волны); зависимая цель стартует от
слияния тех, от кого зависит. Не дроби дальше, чем нужно: лишняя цель стоит прогона трека. В `done` - пункты,
которые исполнитель проверяет командой или чтением файла (тесты, экспорты, строки README и CHANGELOG, локальный
коммит, push не делается). В `boundary` - чего цель не трогает.

ТЗ:
-----
{task}
-----
Верни граф целей по схеме."""


def sh(cmd, cwd=None, env=None, check=True, timeout=None):
    r = subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True, timeout=timeout)
    if check and r.returncode != 0:
        raise RuntimeError('%s -> %d\n%s' % (cmd, r.returncode, r.stderr[-800:]))
    return r


def claude(args, cwd, budget, model, timeout=60 * 60):
    cmd = ['claude', '-p', '--model', model, '--dangerously-skip-permissions', '--output-format', 'json',
           '--max-budget-usd', str(budget)] + ISOLATION + args
    t0 = time.time()
    r = subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, timeout=timeout,
                       env={k: v for k, v in os.environ.items() if k != 'CLAUDECODE'})
    try:
        data = json.loads(r.stdout)
    except ValueError:
        data = {'result': r.stdout[-2000:], 'parse_error': True}
    data['_wall_s'] = round(time.time() - t0, 1)
    data['_rc'] = r.returncode
    data['_stderr'] = r.stderr[-500:]
    return data


def cmd_plan(a):
    task = open(a.task, encoding='utf-8').read()
    data = claude(['--json-schema', json.dumps(PLAN_SCHEMA), PLAN_PROMPT.format(task=task)], a.repo, a.budget, a.model)
    plan = data.get('structured_output')
    if plan is None:
        m = re.search(r'\{.*\}', data.get('result', ''), re.S)
        plan = json.loads(m.group(0)) if m else None
    if not plan or not plan.get('tasks'):
        sys.exit('планировщик не вернул граф: %s' % json.dumps(data, ensure_ascii=False)[:600])
    out = {'plan': plan, 'cost_usd': data.get('total_cost_usd'), 'wall_s': data['_wall_s'], 'model': a.model}
    json.dump(out, open(a.out, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({'tasks': [(t['id'], t['deps']) for t in plan['tasks']], 'cost_usd': out['cost_usd'], 'wall_s': out['wall_s']}, ensure_ascii=False))


def levels(tasks):
    done, result, rest = set(), [], {t['id']: t for t in tasks}
    while rest:
        ready = sorted(i for i, t in rest.items() if all(d in done for d in t['deps']))
        if not ready:
            sys.exit('цикл или неизвестная зависимость: %s' % sorted(rest))
        result.append(ready)
        done.update(ready)
        for i in ready:
            del rest[i]
    return result


def goal_md(t, source):
    done = '\n'.join('- ' + x for x in t['done'])
    bound = '\n'.join('- ' + x for x in t['boundary'])
    return ('# Цель: %s\n\nСтатус: открыт\nРежим: autonomous\nИсход: \nНехватка: \nОжидает: \n\n## Цель\n'
            'Вид: feature\nИсточник: %s\n\n%s\n\n## Критерий «готово»\n%s\n\n## Граница\n%s\n\n## Решения\n'
            % (t['id'], source, t['goal'], done, bound))


def cmd_run(a):
    """Идемпотентный проход: готовые цели не перезапускаются, `blocked` ждёт ответа оператора (--answers)."""
    repo = os.path.abspath(a.repo)
    plan_doc = json.load(open(a.plan, encoding='utf-8'))
    tasks = plan_doc['plan']['tasks']
    by_id = {t['id']: t for t in tasks}
    os.makedirs(a.out, exist_ok=True)
    rep_path = os.path.join(a.out, 'report.json')
    report = json.load(open(rep_path, encoding='utf-8')) if os.path.exists(rep_path) else {
        'plan_cost_usd': plan_doc.get('cost_usd') or 0, 'runs': [], 'merges': [], 'answered': [], 'skipped': {}}
    answers = json.load(open(a.answers, encoding='utf-8')) if a.answers else {}
    cfg = os.environ.get('CLAUDE_CONFIG_DIR') or os.path.expanduser('~/.claude')
    ledger = os.path.join(cfg, 'projects', SLUG_BAD.sub('-', repo), 'ledger')
    ledger_env = {**os.environ, 'DEX_AUTO_CWD': repo}
    ledger_py = os.path.join(HOOKS, 'ledger.py')
    git = lambda *x, **k: sh(['git', '-C', repo, *x], **k)
    led = lambda *x: sh(['python3', '-I', ledger_py, *x], cwd=repo, env=ledger_env, check=False).stdout.strip()
    sh(['git', '-C', repo, 'config', 'user.email', 'wave@local'])
    sh(['git', '-C', repo, 'config', 'user.name', 'wave'])
    if git('rev-parse', '-q', '--verify', 'integration', check=False).returncode != 0:
        git('branch', 'integration', 'main')
    git('checkout', '-q', 'integration')
    plugin_args = []
    for d in [DEX_AUTO] + SKILL_DIRS:
        plugin_args += ['--plugin-dir', d]
    recorded = {r['file'] for r in report['runs']}
    for t in tasks:  # прогоны прежних проходов, чей итог уже лежит в каталоге отчёта
        f = os.path.join(a.out, t['id'] + '.json')
        if os.path.exists(f) and t['id'] + '.json' not in recorded:
            d = json.load(open(f, encoding='utf-8'))
            report['runs'].append({'task': t['id'], 'kind': 'first', 'file': t['id'] + '.json', 'cost_usd': d.get('total_cost_usd'),
                                   'wall_s': d.get('_wall_s'), 'turns': d.get('num_turns')})
    merged = lambda tid: git('merge-base', '--is-ancestor', 'auto/' + tid, 'integration', check=False).returncode == 0
    t_start = time.time()

    def run_goal(item):
        tid, kind = item
        f = '%s.%s.json' % (tid, kind) if kind != 'first' else tid + '.json'
        data = claude(plugin_args + ['/dex-auto:auto %s%s' % (tid, ' продолжить' if kind == 'resume' else '')], repo, a.budget, a.main_model)
        json.dump(data, open(os.path.join(a.out, f), 'w'), ensure_ascii=False, indent=1)
        return {'task': tid, 'kind': kind, 'file': f, 'cost_usd': data.get('total_cost_usd'), 'wall_s': data['_wall_s'],
                'turns': data.get('num_turns'), 'is_error': data.get('is_error')}

    waves = levels(tasks)
    for level in waves:
        todo = []
        for tid in level:
            t = by_id[tid]
            if not all(merged(d) for d in t['deps']):
                report['skipped'][tid] = 'зависимости не влиты: ' + ', '.join(d for d in t['deps'] if not merged(d))
                continue
            report['skipped'].pop(tid, None)
            outcome = led('get', tid, 'Исход')
            if outcome == 'complete':
                continue
            if outcome in ('blocked', 'partial'):
                if tid in answers and tid not in report['answered']:
                    open(os.path.join(ledger, tid, '00-goal.md'), 'a', encoding='utf-8').write('- Оператор: %s\n' % answers[tid])
                    led('set', tid, 'Исход', '')
                    led('set', tid, 'Нехватка', '')
                    report['answered'].append(tid)
                    todo.append((tid, 'resume'))
                continue
            if not os.path.isfile(os.path.join(ledger, tid, '00-goal.md')):
                os.makedirs(os.path.join(ledger, tid), exist_ok=True)
                open(os.path.join(ledger, tid, '00-goal.md'), 'w', encoding='utf-8').write(goal_md(t, 'TASK.md'))
            if git('rev-parse', '-q', '--verify', 'auto/' + tid, check=False).returncode != 0:
                git('branch', 'auto/' + tid, 'integration')
            todo.append((tid, 'first'))
        if todo:
            with ThreadPoolExecutor(max_workers=a.max_parallel) as ex:
                report['runs'].extend(ex.map(run_goal, todo))
        for tid in level:
            if led('get', tid, 'Исход') != 'complete' or merged(tid):
                continue
            m = git('merge', '--no-ff', '-m', 'merge auto/%s' % tid, 'auto/' + tid, check=False)
            entry = {'task': tid, 'conflict': m.returncode != 0}
            if m.returncode != 0:
                conflicted = git('diff', '--name-only', '--diff-filter=U').stdout.split()
                entry['files'] = conflicted
                data = claude(['Идёт слияние ветки auto/%s в integration, есть конфликты в: %s. Разреши их: добавления обеих '
                               'сторон остаются, маркеры убрать, смысл не менять; прогони npm test; заверши слияние коммитом. '
                               'Ничего сверх этого не правь.' % (tid, ', '.join(conflicted))],
                              repo, a.budget, a.main_model, timeout=20 * 60)
                entry['resolver_cost_usd'] = data.get('total_cost_usd')
                entry['resolver_wall_s'] = data['_wall_s']
                entry['resolved'] = git('rev-parse', '-q', '--verify', 'MERGE_HEAD', check=False).returncode != 0
                if not entry['resolved']:
                    git('merge', '--abort', check=False)
            report['merges'].append(entry)
        npm = sh(['npm', 'test', '--silent'], cwd=repo, check=False)
        report.setdefault('npm_test_after_level', {})[','.join(level)] = npm.returncode == 0
    if a.final_review and not report.get('final_review') and all(merged(t['id']) for t in tasks):
        base = sh(['git', '-C', repo, 'rev-list', '--max-parents=0', 'HEAD']).stdout.split()[0]
        data = claude(['Проведи ревью общего диффа `git diff %s..HEAD` в этом репозитории: дефекты, расхождения с TASK.md, '
                       'конфликты решений между модулями. Только перечень находок с файлом и строкой; ничего не правь.' % base],
                      repo, a.budget, 'opus', timeout=20 * 60)
        report['final_review'] = {'cost_usd': data.get('total_cost_usd'), 'wall_s': data['_wall_s'], 'result': (data.get('result') or '')[:3000]}
    costs = {'plan': report['plan_cost_usd'],
             'goals_first': round(sum(r['cost_usd'] or 0 for r in report['runs'] if r['kind'] == 'first'), 4),
             'goals_resume': round(sum(r['cost_usd'] or 0 for r in report['runs'] if r['kind'] == 'resume'), 4),
             'resolver': round(sum(m.get('resolver_cost_usd') or 0 for m in report['merges']), 4),
             'final_review': (report.get('final_review') or {}).get('cost_usd') or 0}
    costs['total'] = round(sum(costs.values()), 4)
    report['costs'] = costs
    report['wall_s_this_pass'] = round(time.time() - t_start, 1)
    report['needs_operator'] = sorted(t['id'] for t in tasks if led('get', t['id'], 'Исход') in ('blocked', 'partial'))
    report['done'] = sorted(t['id'] for t in tasks if merged(t['id']))
    json.dump(report, open(rep_path, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: report[k] for k in ('costs', 'wall_s_this_pass', 'needs_operator', 'done', 'skipped', 'merges')}, ensure_ascii=False, indent=1))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('plan')
    p.add_argument('repo'); p.add_argument('--task', required=True); p.add_argument('--model', default='opus')
    p.add_argument('--out', required=True); p.add_argument('--budget', type=float, default=3)
    r = sub.add_parser('run')
    r.add_argument('repo'); r.add_argument('--plan', required=True); r.add_argument('--out', required=True)
    r.add_argument('--main-model', default='sonnet'); r.add_argument('--max-parallel', type=int, default=4)
    r.add_argument('--budget', type=float, default=10); r.add_argument('--final-review', action='store_true')
    r.add_argument('--answers', help='json {id: ответ оператора} для целей в blocked/partial')
    a = ap.parse_args()
    {'plan': cmd_plan, 'run': cmd_run}[a.cmd](a)


if __name__ == '__main__':
    main()
