#!/usr/bin/env python3
"""Пакет «лестница»: пакет планировщика на 13 кейсах, кейсы по одному на haiku medium.

  python3 -I ladder-pack.py <рабочая директория с pack/ от планировщика> <новая директория>

Новая директория должна быть собрана `harness.mjs tree` (кейсы c01..c13). Берёт пакет, который
выдал планировщик (`harness.mjs plan <dir> --force`), и меняет только маршрутизацию:
вместо четырёх партий sonnet - тринадцать задач по кейсу на haiku medium; повтор - по лестнице
скилла-исполнителя. Проверки (checks/), форма отчёта и каркас повтора - без изменений.
"""
import json, os, re, shutil, sys

SRC = os.path.abspath(sys.argv[1])
DST = os.path.abspath(sys.argv[2])
OLD_ROOT = SRC
NEW_ROOT = DST

shutil.copytree(f'{SRC}/pack', f'{DST}/pack', dirs_exist_ok=True)
# корень в тексте пакета
for dp, _, fs in os.walk(f'{DST}/pack'):
    for f in fs:
        p = os.path.join(dp, f)
        try:
            t = open(p, encoding='utf-8').read()
        except UnicodeDecodeError:
            continue
        if OLD_ROOT in t:
            open(p, 'w', encoding='utf-8').write(t.replace(OLD_ROOT, NEW_ROOT))

cases = [l.split('\t') for l in open(f'{DST}/pack/checks/cases.tsv', encoding='utf-8').read().strip().split('\n')]
RO = {'c06': 'c06/PROJECT_RULES.md', 'c10': 'c10/references/channel-registry.md'}
USER_LINE = {
    'c06': '> c06: В этом кейсе правится migration-writer.md; PROJECT_RULES.md лежит рядом как контекст и не правится.',
    'c10': '> c10: В этом кейсе правится release-track.md; references/channel-registry.md - его дом, лежит рядом и не правится.',
}
HAIKU_ADD = (
    '\n## Добавка для исполнителя на haiku\n'
    '> Работай, пока всё, что просили, не сделано, и останавливайся с вопросом, только если дальше\n'
    '> нельзя без ответа или перед рискованным шагом. Когда работа сделана и проверена, остановись и\n'
    '> отчитайся. Не добавляй фичи, документы и рефакторинг, о которых не просили; если считаешь, что\n'
    '> нужно, упомяни в конце.\n'
)

# брифы по кейсу из каркаса повтора
tpl = open(f'{DST}/pack/briefs/_retry_case.md', encoding='utf-8').read()
tpl = re.sub(r'^<!--.*?-->\n', '', tpl, flags=re.S)
# первая попытка: убрать абзац о предыдущей попытке
tpl = re.sub(r'Предыдущая попытка этого кейса не прошла приёмку:.*?прошлую попытку не ищешь\.\n\n', '', tpl, flags=re.S)
tpl = tpl.replace('Бриф r-<кейс>-a<попытка>: optimize-for-llm, повтор кейса <кейс>', 'Бриф h<н>: optimize-for-llm, кейс <кейс>')
for i, (c, f) in enumerate(cases, 1):
    b = tpl
    b = b.replace('h<н>', f'h{i:02d}').replace('<кейс>/<файл правки>', f'{c}/{f}').replace('<кейс>', c)
    b = b.replace('| <кейс> | `' + f'{c}/{f}' + '` | <`путь` из таблицы задач PLAN.md либо `-`> |', '')
    b = b.replace('<`путь` из таблицы задач PLAN.md либо `-`>', f'`{RO[c]}`' if c in RO else '-')
    # строка c06/c10 из задачи пользователя
    b = re.sub(r'<строка c06 или c10 из задачи пользователя, если кейс - c06 или c10; иначе строку удалить>\n', (USER_LINE.get(c, '') + '\n') if c in USER_LINE else '', b)
    b = b.replace('Пишешь только: `' + f'{c}/{f}' + '`, `' + f'{c}/REPORT.md' + '`.', 'Пишешь только: `' + f'{c}/{f}' + '`, `' + f'{c}/REPORT.md' + '`.')
    b = b.rstrip('\n') + '\n' + HAIKU_ADD
    open(f'{DST}/pack/briefs/h{i:02d}.md', 'w', encoding='utf-8').write(b)
for n in ['b1', 'b2', 'b3', 'b4']:
    os.remove(f'{DST}/pack/briefs/{n}.md')

# PLAN.md
plan = open(f'{DST}/pack/PLAN.md', encoding='utf-8').read()
plan = plan.replace('limits: {max_parallel: 2, max_spawn: 14, depth: 1, max_attempts: 3, budget_usd: null}',
                    'limits: {max_parallel: 2, max_spawn: 40, depth: 1, max_attempts: 4, budget_usd: null}')

def section(start, end):
    i = plan.index(start)
    j = plan.index(end, i) if end else len(plan)
    return i, j

rows = []
for i, (c, f) in enumerate(cases, 1):
    writes = f'`{c}/{f}`, `{c}/REPORT.md`'
    rows.append(f'| h{i:02d} | рез кейса {c} | t00 | agent | mechanical | haiku | medium | 1/1/1/1 | {writes} | '
                f'`python3 -I pack/checks/case_tool.py check {c}` -> PASS | `briefs/h{i:02d}.md` |')
sec4 = (
    '## 4. Задачи\n\n'
    '| id | цель | зависит | исполнитель | категория | модель | effort | A/B/N/V | пишет | check | бриф |\n'
    '|---|---|---|---|---|---|---|---|---|---|---|\n'
    '| t00 | снимок оригиналов в `pack/originals/` | - | self | - | - | - | 0/0/0/0 | `pack/originals/` | '
    '`python3 -I pack/checks/case_tool.py snapshot` -> «снимок: 13 кейсов» или «снимок уже есть» | - |\n'
    + '\n'.join(rows) + '\n'
    '| t99 | краткий итог пользователю | все кейсы PASS или `blocked` | self | - | - | - | 0/1/1/1 | ответ в чате | '
    'у каждого из 13 кейсов строка в итоге | - |\n\n'
    'Неприкосновенны (только чтение): `c06/PROJECT_RULES.md`, `c10/references/channel-registry.md`;\n'
    '`check` сверяет их байтами со снимком.\n\n'
    'Категория `mechanical` назначена по политике «сначала дёшево, повтор выше»: у каждой задачи есть\n'
    'машинная проверка (`check`), цена провала `haiku` - центы, а повтор по сигналу проверки поднимает\n'
    'кейс по лестнице исполнителя. Это отступление от таблицы категорий (там `A=1` даёт `standard`),\n'
    'причина названа здесь: измеренная проходимость `haiku` `medium` 58%, лестница до `opus` - 100%.\n\n'
)
i, j = section('## 4. Задачи', '## 6. Маршрутизация новых задач')
sec5 = (
    '## 5. Волны\n\n'
    '| Волна | Задачи | Условие старта |\n|---|---|---|\n'
    '| 0 | t00 | сразу |\n'
    '| 1 | h01..h13 | t00 прошёл; не больше двух одновременно (`max_parallel`), следующая - как освободится слот |\n'
    '| 1\' | `r-*` | повтор кейса после провала, в свободный слот; новые кейсы стартуют раньше повторов |\n'
    '| 2 | t99 | у всех 13 кейсов исход: PASS или `blocked` |\n\n'
)
plan = plan[:i] + sec4 + sec5 + plan[j:]

# исключения из лестницы
i = plan.index('**Исключения из лестницы повторов**')
j = plan.index('**Учёт.**')
exc = (
    '**Исключения из лестницы повторов** (остальное - по скиллу-исполнителю):\n'
    '1. Единица повтора - кейс; каждый кейс - своя задача, принятые не повторяются.\n'
    '2. Перед повтором: `python3 -I pack/checks/case_tool.py restore <кейс> <номер провалившейся\n'
    '   попытки>` - попытка уходит в `pack/attempts/<кейс>-a<N>/`, кейс возвращается к снимку.\n'
    '3. Ступени - лестница скилла-исполнителя от `haiku` `medium`: попытка 2 - `haiku` `high`, 3 -\n'
    '   `sonnet` `medium`, 4 - `opus` `medium`; новая попытка - задача `r-<кейс>-a<N>`.\n'
    '4. Бриф повтора - из `briefs/_retry_case.md`: заполни `<...>`, вставь строку провала дословно,\n'
    '   сохрани как `briefs/r-<кейс>-a<N>.md`; для `haiku` добавь абзац «Добавка для исполнителя на\n'
    '   haiku» из `briefs/h01.md`. Рассуждения и файлы прошлой попытки в бриф не идут.\n'
    '5. `NEEDS_CONTEXT`/`BLOCKED` из-за нехватки самого пакета (путь, снимок, скрипт) - чинишь пакет и\n'
    '   повторяешь ту же ступень один раз, запись в «Журнал изменений плана»; иное препятствие -\n'
    '   вопрос пользователю.\n'
    '6. После четырёх попыток: кейс `blocked`, остаётся в состоянии снимка (оригинал), последняя\n'
    '   попытка - в `pack/attempts/`; кейс идёт пользователю в итоге.\n\n'
)
plan = plan[:i] + exc + plan[j:]
plan = plan.replace('`ledger.json`: статус партии `done`, когда каждый её кейс принят или передан в `r-*`;',
                    '`ledger.json`: статус задачи кейса `done`, когда он принят;')
plan = plan.replace('(`rated_by: orchestrator`, категория `deep` / `deep-hard` по ступени)',
                    '(`rated_by: orchestrator`, категория по ступени лестницы)')

# приёмка кейса: партии больше нет
plan = plan.replace('`python3 -I pack/checks/case_tool.py check <кейсы партии>`', '`python3 -I pack/checks/case_tool.py check <кейс>`')

# расчёт и допущения
i, j = section('## 8. Расчёт', '## 10. Журнал изменений плана')
sec89 = (
    '## 8. Расчёт\n\n'
    'Метод: цена по измеренной лестнице (`routing.md` планировщика, «Приоры», замер 2026-10-08 на этом\n'
    'же предмете и этих же 13 кейсах): лестница `haiku` `medium` -> `haiku` `high` -> `sonnet` `medium`\n'
    '-> `opus` `medium` стоила 0.086 $ за кейс (1.12 $ за 13) при проходимости 100% (симуляция, проверка -\n'
    'грейдер). К этому добавляется оркестратор `sonnet` `high` (по прежнему расчёту около 0.75 $) и\n'
    'потери от более слабой проверки `check`. Ожидаемо около 2 $ без плана против `solo` `opus` `medium`\n'
    '2.05 $: выигрыш не ожидается; пакет назван как проверка политики «сначала дёшево» на живом\n'
    'исполнителе, не как рекомендация оркестрировать этот предмет.\n\n'
    '## 9. Допущения и риски\n\n'
    '- Алиасы `haiku`/`sonnet`/`opus` ведут на 5.5 - Claude Code 2.1.294, переменных провайдера нет.\n'
    '- Проходимость `haiku` `medium` на кейс 58% (измерено); `check` ловит форму отчёта, правку\n'
    '  соседних файлов и тихую потерю литералов, а смысл без литералов не судит - проходимость по\n'
    '  `check` выше проходимости по смыслу; оговорка идёт в итог.\n'
    '- `max_spawn` 40 = 13 стартов + запас на повторы (до 3 ступеней на кейс).\n'
    '- Файлы правятся на месте без git: откат - из `pack/originals/` (t00 обязателен до волны 1).\n'
    '- Ветка «Вызов не состоялся» для `norm-writing` оставляет недописанные единицы нетронутыми;\n'
    '  перечень идёт пользователю в итоге.\n\n'
)
plan = plan[:i] + sec89 + plan[j:]
plan = plan.replace('Раз оркестрируем, кейсы идут **партиями**', 'Кейсы здесь идут по одному (политика лестницы, раздел 4), а не партиями')
open(f'{DST}/pack/PLAN.md', 'w', encoding='utf-8').write(plan)

# ledger
led = json.load(open(f'{DST}/pack/ledger.json', encoding='utf-8'))
tmpl = {k: None for k in led['tasks'][1]}
tasks = [led['tasks'][0]]
for i, (c, f) in enumerate(cases, 1):
    t = dict(led['tasks'][1])
    t.update({'id': f'h{i:02d}', 'status': 'pending', 'category': 'mechanical', 'model': 'haiku', 'effort': 'medium',
              'attempt': 0, 'depends': ['t00'], 'report': None, 'evidence': None, 'reason': None, 'tokens': None, 'duration_ms': None})
    tasks.append(t)
last = dict(led['tasks'][-1]); last['depends'] = [f'h{i:02d}' for i in range(1, 14)]
tasks.append(last)
led['tasks'] = tasks
led['routing_log'] = [{'task': f'h{i:02d}', 'axes': {'A': 1, 'B': 1, 'N': 1, 'V': 1}, 'category': 'mechanical', 'rated_by': 'ladder-policy', 'outcome': None} for i in range(1, 14)]
led['changes'] = []; led['spawned'] = 0
json.dump(led, open(f'{DST}/pack/ledger.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('ok', DST)
