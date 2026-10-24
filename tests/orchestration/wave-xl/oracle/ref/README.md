# textkit

Небольшая библиотека работы с текстом. Node, ESM, без зависимостей.

## API

| Имя | Модуль | Назначение |
|---|---|---|
| `countWords(text)` | `src/words.js` | число слов в строке |
| `parse(text, options)` | `src/csv.js` | CSV по RFC 4180 |
| `stringify(rows, options)` | `src/csv.js` | CSV по RFC 4180 |
| `getPointer(doc, pointer)` | `src/jsonpatch.js` | JSON Pointer и JSON Patch |
| `applyPatch(doc, ops)` | `src/jsonpatch.js` | JSON Pointer и JSON Patch |
| `parseCron(expr)` | `src/cron.js` | cron-выражения |
| `nextRun(expr, from)` | `src/cron.js` | cron-выражения |
| `render(template, data)` | `src/template.js` | шаблонизатор |
| `globToRegExp(pattern)` | `src/glob.js` | glob-сопоставление путей |
| `isMatch(path, pattern)` | `src/glob.js` | glob-сопоставление путей |
| `diffLines(a, b)` | `src/diff.js` | построчный diff |
| `unifiedDiff(a, b, options)` | `src/diff.js` | построчный diff |
| `evaluate(text, vars)` | `src/expr.js` | арифметические выражения |
| `toposort(graph)` | `src/toposort.js` | топологическая сортировка |
| `layers(graph)` | `src/toposort.js` | топологическая сортировка |
| `Router` | `src/router.js` | маршрутизатор путей |
| `strftime(date, format)` | `src/strftime.js` | форматирование даты |
| `isoWeek(date)` | `src/strftime.js` | форматирование даты |
| `parseIni(text)` | `src/ini.js` | диалект INI |
| `stringifyIni(obj)` | `src/ini.js` | диалект INI |
| `wrap(text, width, options)` | `src/wrap.js` | перенос строк |
| `justify(line, width)` | `src/wrap.js` | перенос строк |

## Тесты

`npm test`
