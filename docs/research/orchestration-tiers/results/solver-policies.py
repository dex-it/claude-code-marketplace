#!/usr/bin/env python3
"""Кто выбирает стартовую ступень: триаж haiku / sonnet / opus, без триажа, всезнающий выбор.

Симуляция по ladder.csv (130 прогонов по одному кейсу) и triage-*.json (оценки 13 описаний).
Ступени лестницы: haiku-medium, haiku-high, sonnet-medium, opus-medium (в скилле). Вероятность
прохода ступени на кейсе - доля прошедших прогонов; повторы считаются независимыми; последняя
ступень принята за 100% (opus-medium прошёл 13 из 13). Проверка - грейдер (идеальная проверка).
Цена триажа входит в цену политики. Запуск: python3 -I solver-policies.py (из этой папки).
"""
import csv, json, statistics as st
from collections import defaultdict

rows = list(csv.DictReader(open('ladder.csv', encoding='utf-8')))
P, C, T = defaultdict(list), defaultdict(list), defaultdict(list)
for r in rows:
    k = (r['config'], r['case'])
    P[k].append(int(r['pass'])); C[k].append(float(r['cost_usd'])); T[k].append(float(r['wall_s']))
cases = sorted({r['case'] for r in rows})
LADDER = ['haiku-medium', 'haiku-high', 'sonnet-medium', 'opus-medium']
tri = {f: json.load(open(f'triage-{f}-medium.json', encoding='utf-8')) for f in ('haiku', 'sonnet', 'opus')}


def run(start_of, tri_cost):
    tot_cost, tot_pass, tot_wall = tri_cost, 0.0, 0.0
    for c in cases:
        s = LADDER.index(start_of(c))
        reach = 1.0
        for t in LADDER[s:]:
            tot_cost += reach * st.mean(C[(t, c)]); tot_wall += reach * st.mean(T[(t, c)])
            pp = 1.0 if t == 'opus-medium' else st.mean(P[(t, c)])
            tot_pass += reach * pp; reach *= (1 - pp)
    n = len(cases)
    return tot_pass / n, tot_cost, tot_cost / n, tot_wall / n


def by_triage(f):
    d = tri[f]['cases']
    return lambda c: 'haiku-medium' if d[c]['category'] == 'mechanical' else 'sonnet-medium'


def oracle(c):  # дешевейшая ступень, прошедшая кейс во всех прогонах
    for t in LADDER:
        if st.mean(P[(t, c)]) == 1.0:
            return t
    return 'opus-medium'


print('%-52s %6s %9s %8s %7s' % ('политика', 'pass', '$ за 13', '$/кейс', 'с/кейс'))
def show(name, res): print('%-52s %5.0f%% %9.2f %8.3f %7.0f' % (name, res[0] * 100, res[1], res[2], res[3]))
show('без решателя: старт haiku-medium, лестница вверх', run(lambda c: 'haiku-medium', 0))
for f in ('haiku', 'sonnet', 'opus'):
    show(f'триаж {f}: mechanical -> haiku-m, иначе sonnet-m', run(by_triage(f), tri[f]['cost_usd']))
show('без решателя: старт sonnet-medium', run(lambda c: 'sonnet-medium', 0))
show('без решателя: старт opus-medium', run(lambda c: 'opus-medium', 0))
show('всезнающий статический выбор', run(oracle, 0))

print('\nСигнал триажа: доля прохода haiku-medium на кейсах по метке (база %.2f)' % st.mean(st.mean(P[('haiku-medium', c)]) for c in cases))
for f in ('haiku', 'sonnet', 'opus'):
    d = tri[f]['cases']
    mech = [c for c in cases if d[c]['category'] == 'mechanical']
    std = [c for c in cases if d[c]['category'] != 'mechanical']
    m = '%.2f' % st.mean(st.mean(P[('haiku-medium', c)]) for c in mech) if mech else '-'
    s = '%.2f' % st.mean(st.mean(P[('haiku-medium', c)]) for c in std)
    print(f'{f:7s} mechanical: {len(mech):2d} кейсов, проход {m}; standard: {len(std):2d} кейсов, проход {s}; цена триажа ${tri[f]["cost_usd"]:.3f}')
