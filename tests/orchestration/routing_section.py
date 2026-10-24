"""Раздел 6 PLAN.md как в настоящем пакете: копия из скилла и routing.md планировщика.

Общий помощник фикстур `modes/gen.py` и `skills/gen.py`: оркестратор маршрутизирует новые задачи по
этой таблице и, при предмете «промт», подбирает скиллы по правилам раздела «Подбор скиллов».
"""
import os

PLANNER = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       'subject/dex-skill-orchestration-planner/skills/orchestration-planner')


def routing_section(with_skills):
    skill = open(os.path.join(PLANNER, 'SKILL.md'), encoding='utf-8').read()
    routing = open(os.path.join(PLANNER, 'references/routing.md'), encoding='utf-8').read()
    cat_table = skill[skill.index('| Категория | Модель |'):].split('\n\n')[0]
    axes = routing[routing.index('## Оси оценки трудности (0-2)'):routing.index('## Цены')]
    out = '### Категории\n\n' + cat_table + '\n\n### ' + axes[3:].replace('\n## ', '\n### ').rstrip()
    if with_skills:
        rules = skill[skill.index('## Подбор скиллов'):skill.index('## Схема исполнения')].rstrip()
        out += '\n\n### ' + rules[3:]
    return out
