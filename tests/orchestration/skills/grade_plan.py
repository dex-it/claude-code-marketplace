#!/usr/bin/env python3
"""Оценка прогона `run.mjs --role plan`: скиллы, промты и исполнители в пакете планировщика.

    python3 -I grade_plan.py <каталог> --set pick|given|folder|mix|temp [--orch M] [--fork 0|1]

Назначение читается из таблицы задач и брифов, а не из прозы плана: отвергнутый кандидат в разделе
«Предмет» назначением не считается. Планировщик скилл-предмет не вызывает, а читает файл: вызов
`Skill` на скилле-фикстуре из его потока - провал. Для `mix` задачи сопоставляются работам экзамена
способов по ключевому слову (VERSION, src/p, report.md, vendor_notes, app.log, src/k).
"""
import argparse, glob, hashlib, json, os, re, subprocess, sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('run')
ap.add_argument('--set', default='pick')
ap.add_argument('--orch', default='opus')
ap.add_argument('--fork', default='0')
a = ap.parse_args()
run, S = a.run, a.set

skill_calls, results = [], []
for line in open(os.path.join(run, 'stream.jsonl'), encoding='utf-8'):
    try:
        d = json.loads(line)
    except ValueError:
        continue
    if d.get('type') == 'assistant':
        for b in d['message']['content']:
            if b['type'] == 'tool_use' and b['name'] == 'Skill':
                skill_calls.append(str(b['input'].get('skill', '')))
    if d.get('type') == 'result':
        results.append(d)
res = results[-1] if results else {}

checks = {}


def ck(name, ok, detail=None):
    checks[name] = {'ok': bool(ok), **({'detail': detail} if detail is not None else {})}


def rd(p):
    try:
        return open(os.path.join(run, p), encoding='utf-8').read()
    except OSError:
        return ''


plan = rd('pack/PLAN.md')
briefs = {os.path.basename(p): open(p, encoding='utf-8').read() for p in glob.glob(os.path.join(run, 'pack/briefs/*.md'))
          if not os.path.basename(p).startswith('_')}
temp = {os.path.basename(p): open(p, encoding='utf-8').read() for p in glob.glob(os.path.join(run, 'pack/prompts/*.md'))}

# таблица задач: колонки по заголовку
rows, cols = [], []
lines = plan.split('\n')
for i, l in enumerate(lines):
    if l.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:|-]+\|$', lines[i + 1]):
        c = [x.strip().lower() for x in l.strip('|').split('|')]
        if 'id' in c and any(x.startswith('модель') for x in c):
            cols = c
            j = i + 2
            while j < len(lines) and lines[j].startswith('|'):
                rows.append([x.strip() for x in lines[j].strip('|').split('|')])
                j += 1
            break


def col(r, name):
    for k, c in enumerate(cols):
        if c.startswith(name) and k < len(r):
            return r[k].replace('`', '')
    return ''


tasks = [{'id': col(r, 'id'), 'goal': col(r, 'цель'), 'exec': col(r, 'исполнитель').lower(), 'model': col(r, 'модель').lower(),
          'effort': col(r, 'effort').lower(), 'writes': col(r, 'пишет'), 'skills': col(r, 'скиллы'), 'prompts': col(r, 'промты'),
          'brief': col(r, 'бриф'), 'row': ' '.join(r)} for r in rows]


def brief_text(t):
    b = os.path.basename(t['brief'] or '')
    return briefs.get(b, '')


def about(key):
    return [t for t in tasks if key in t['row'] or key in brief_text(t)]


def assigned(t, name):
    return name in t['skills'] or name in t['prompts'] or name in brief_text(t)


subj = (re.search(r'^subject:.*$', plan, re.M) or [''])[0]
orch = (re.search(r'^orchestrator:.*$', plan, re.M) or [''])[0]
lint = subprocess.run(['node', os.path.join(HERE, '../lint-pack.mjs'), os.path.join(run, 'pack'), '--expect', 'orchestrate', '--max-parallel', '2'],
                      capture_output=True, text=True)
ck('пакет написан: PLAN.md, таблица задач, брифы', bool(plan) and len(tasks) >= 3 and len(briefs) >= 3, (len(tasks), sorted(briefs)))
ck('lint-pack без провалов', lint.returncode == 0, (lint.stdout + lint.stderr)[-300:])
FX = ('csv-audit', 'release-notes', 'sql-review', 'export-all', 'translate-ru-en', 'sql-style')
ck('планировщик не вызывал Skill на скиллах-фикстурах', not any(x.startswith('fx-') or any(n in x for n in FX) for x in skill_calls), skill_calls)
everything = plan + ''.join(briefs.values())
ck('приманки не назначены: ни в колонках, ни в брифах (упоминание отвергнутого в «Предмет» допустимо)',
   not any(assigned(t, n) for t in tasks for n in ('sql-review', 'export-all', 'sql-style')))
summary = {}

if S in ('pick', 'given', 'folder'):
    csv_t, notes_t, tr_t = about('data.csv'), about('CHANGES.txt'), about('note.txt')
    ck('аудит csv: назван csv-audit', csv_t and all(assigned(t, 'csv-audit') for t in csv_t))
    if S == 'pick' or S == 'folder':
        ck('предмет в шапке - prompt', bool(re.search(r'kind:\s*prompt', subj)), subj)
        ck('заметки: назван release-notes', notes_t and all(assigned(t, 'release-notes') for t in notes_t))
        ck('правила «Подбор скиллов и промтов» едут в пакет (раздел 6)', 'Подбор скиллов' in plan)
    else:
        ck('предмет в шапке - skill или both', bool(re.search(r'kind:\s*(skill|both)', subj)), subj)
        ck('заметки: чужой скилл release-notes не назначен', notes_t and not any(assigned(t, 'release-notes') for t in notes_t))
    if S == 'folder':
        ck('перевод: назван промт translate-ru-en из каталога', tr_t and all(assigned(t, 'translate-ru-en') for t in tr_t))
        ck('в шапке назван prompts_dir', 'prompts_dir' in subj and 'prompts' in subj, subj)
        inv = about('inventory')
        shared = [n for n, body in temp.items() if sum(1 for t in inv if n in (t['row'] + brief_text(t))) >= 2]
        ck('inventory: либо одна задача на все три файла, либо общий временный промт в prompts/ пакета',
           bool(inv) and (len(inv) == 1 or bool(shared)), {'tasks': len(inv), 'temp': sorted(temp), 'shared': shared})
        ck('временные промты не содержат просьб «думай меньше» и вывода рассуждений',
           not any(re.search(r'думай меньше|выпиши (?:цепочку )?рассуждени', b, re.I) for b in temp.values()))
        ck('каталог пользователя не пополнен', sorted(os.listdir(os.path.join(run, 'prompts'))) == ['sql-style.md', 'translate-ru-en.md'])
    else:
        ck('перевод: ни скилла, ни промта', tr_t and not any(re.search(r'csv-audit|release-notes|translate', t['skills'] + t['prompts']) for t in tr_t))
        if S == 'pick':
            ck('перевод: в «Предмет» записан no-skill', 'no-skill' in plan)
    summary = {'rows': [(t['id'], t['exec'], t['model'], t['skills'], t['prompts']) for t in tasks], 'temp_prompts': sorted(temp)}
elif S == 'temp':
    grp = about('src/p') or about('c01')
    shared = [n for n in temp if sum(1 for t in grp if f'prompts/{n}' in (t['row'] + brief_text(t))) >= 2]
    ck('ревью: задачи по группам модулей найдены', len(grp) >= 1, len(grp))
    ck('ревью: либо одна задача на все группы, либо общий временный промт в prompts/ пакета, названный в брифах',
       len(grp) == 1 or bool(shared), {'tasks': len(grp), 'temp': sorted(temp), 'shared': shared})
    ck('временный промт не пуст и без просьб «думай меньше» и вывода рассуждений',
       all(len(b.strip()) > 200 and not re.search(r'думай меньше|выпиши (?:цепочку )?рассуждени', b, re.I) for b in temp.values()))
    ck('каталог пользователя не пополнен и не изменён', sorted(os.listdir(os.path.join(run, 'prompts'))) == ['sql-style.md', 'translate-ru-en.md'])
    ck('промты каталога, не относящиеся к ревью, не назначены', not any(re.search(r'translate-ru-en|sql-style', t['prompts'] + brief_text(t)) for t in tasks))
    summary = {'rows': [(t['id'], t['exec'], t['model'], t['prompts']) for t in tasks], 'temp_prompts': sorted(temp)}
else:  # mix: кто исполняет и сколько
    KEYS = {'N1': 'VERSION', 'N2': 'src/p', 'N3': 'report.md', 'N4': 'vendor_notes', 'N5': 'app.log', 'N7': 'src/k'}
    TIER = {'haiku': 1, 'sonnet': 2, 'opus': 3}
    om = (re.search(r'model:\s*(\w+)', orch) or [None, ''])[1]
    by = {n: about(k) for n, k in KEYS.items()}
    ex = lambda t: 'fork' if 'fork' in t['exec'] else ('self' if 'self' in t['exec'] or t['model'] in ('-', '') else 'agent')
    ck('N1 (короткая работа): self', by['N1'] and all(ex(t) == 'self' for t in by['N1']), [(t['id'], t['exec']) for t in by['N1']])
    ck('N3 (независимая проверка): agent не ниже sonnet, не fork и не self',
       by['N3'] and all(ex(t) == 'agent' and TIER.get(t['model'], 0) >= 2 for t in by['N3']), [(t['id'], t['exec'], t['model']) for t in by['N3']])
    ck('N4 (недоверенное): agent не выше sonnet, не fork и не self',
       by['N4'] and all(ex(t) == 'agent' and 0 < TIER.get(t['model'], 9) <= 2 for t in by['N4']), [(t['id'], t['exec'], t['model']) for t in by['N4']])
    ck('N5 (исследование): agent opus, либо fork при оркестраторе opus',
       by['N5'] and all((ex(t) == 'agent' and t['model'] == 'opus') or (ex(t) == 'fork' and om == 'opus') for t in by['N5']),
       [(t['id'], t['exec'], t['model']) for t in by['N5']] + [om])
    ck('N7 (глоссарий сессии): не self и не haiku; fork только при оркестраторе sonnet+',
       by['N7'] and all(ex(t) != 'self' and t['model'] != 'haiku' and (ex(t) != 'fork' or TIER.get(om, 0) >= 2) for t in by['N7']),
       [(t['id'], t['exec'], t['model']) for t in by['N7']] + [om])
    ck('N2 (объёмная работа без контекста сессии): agent, не self',
       by['N2'] and all(ex(t) == 'agent' for t in by['N2']), [(t['id'], t['exec'], t['model']) for t in by['N2']])
    forks = [t for t in tasks if ex(t) == 'fork']
    ck('каждый fork несёт модель, effort и бриф (запасной agent)', all(t['model'] in TIER and t['effort'] and t['brief'] for t in forks), [t['id'] for t in forks])
    ck('условие форка записано в «Инструкции оркестратору»', not forks or bool(re.search(r'fork|форк', plan.split('Инструкции оркестратору')[-1], re.I)))
    ck('число задач не раздуто: не больше 12 строк таблицы', len(tasks) <= 12, len(tasks))
    summary = {'rows': [(t['id'], ex(t), t['model'], t['effort']) for t in tasks], 'orchestrator': orch, 'forks': [t['id'] for t in forks]}

bad = [k for k, v in checks.items() if not v['ok']]
print(json.dumps({'run': os.path.basename(os.path.abspath(run)), 'set': S, 'orch': a.orch,
                  'cost': round(res.get('total_cost_usd', 0), 3), 'results': len(results), 'subject': subj,
                  'skill_calls': skill_calls, **summary, 'failed': bad, 'checks': checks}, ensure_ascii=False, indent=1))
sys.exit(1 if bad else 0)
