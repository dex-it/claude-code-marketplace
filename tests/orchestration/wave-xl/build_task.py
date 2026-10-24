#!/usr/bin/env python3
"""Собирает TASK.md из `spec/*.md`: шапка, разделы с номерами вместо `{N}`, сквозная правка последней.

    python3 -I build_task.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ['csv', 'jsonpatch', 'cron', 'template', 'glob', 'diff', 'expr', 'toposort', 'router', 'strftime',
         'ini', 'wrap', 'template-filters']
num = {m: i + 1 for i, m in enumerate(ORDER)}

HEAD = f"""# textkit 0.2: {len(ORDER)} добавлений

Библиотека `textkit` (Node, ESM, без зависимостей, тесты - `node --test`, `npm test`). Нужны {len(ORDER) - 1} новых модулей
и одна правка, связывающая три из них.

Общие требования к каждому модулю:

- публичные имена экспортируются из `src/index.js` (одна строка `export` на модуль, в конец файла);
- в таблицу API в `README.md` - по строке на публичное имя (в конец таблицы);
- в `CHANGELOG.md` под `## Unreleased` - по строке на модуль, с его именем (в конец списка);
- тесты в `test/<модуль>.test.js` покрывают поведение, описанное ниже;
- `npm test` зелёный; работа сдаётся локальным коммитом, push не делается.
"""

parts = [HEAD]
for m in ORDER:
    text = open(os.path.join(HERE, 'spec', m + '.md'), encoding='utf-8').read().strip()
    text = text.replace('{N}', str(num[m]))
    text = text.replace('{T}', str(num['template'])).replace('{S}', str(num['strftime'])).replace('{W}', str(num['wrap']))
    assert '{' + 'N}' not in text, m
    parts.append(text)
open(os.path.join(HERE, 'TASK.md'), 'w', encoding='utf-8').write('\n\n'.join(parts) + '\n')
print(os.path.join(HERE, 'TASK.md'))
