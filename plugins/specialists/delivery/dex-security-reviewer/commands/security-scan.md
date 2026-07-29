---
description: Глубокий security-проход по коду/diff (языко-агностично) - threat model, attack paths, цепочки эксплойтов
allowed-tools: Read, Grep, Glob
argument-hint: "<пути, diff-range или MR/PR url> [границы доверенного контура]"
---

# /security-scan

Провести глубокий security-проход по коду или diff: модель угроз, пути атак, цепочки эксплойтов. Не общий код-ревью.

## Goal

Пройти фазы агента `security-reviewer`: Threat Model & Attack Surface, Attack-Path Analysis, Deep Category Scan, Exploit-Chain & Scoring.

## Input

Что смотреть: пути, diff-range или указатель MR/PR, и границы контура - что считается доверенным. Чего нет - сказать прямо, агент не додумывает. Стек определяется по манифестам проекта, профильные skills под него подбирает сам агент.

## Output

- Status: исход узла (`complete` / `blocked` / `partial`) первым полем
- Threat Model: акторы (anon/user/admin/service), границы доверия, активы
- Attack Paths: граница -> вектор -> актив по достижимым OWASP-категориям
- Exploit Chains: связанные находки, по каждой результат попытки опровержения, `severity` по эксплуатируемости цепочки, `confidence`, `scope`, `closure` - критерий, когда цепочка закрыта
- Evidence: `anchor` file:line по звеньям и достижимый путь атаки на каждую цепочку
- Fact-check: техутверждения звеньев - `verified` / `unverifiable` / `contradicted` + что сверялось; звенья, снятые по `contradicted`, названы здесь же; триггер не сработал - `n/a`
- Verdict: BLOCK, если есть CRITICAL-цепочка, иначе по максимальной severity

Перечисленное обязательно - это нижняя граница, агент отдаёт не меньше. Живёт оно у агента в двух местах, и ни одно не покрывает всё: поля стыка (`status`, блок `fact-check`, `scope`, `closure`) - в разделе `**Output (handoff):**`, продукт фаз (threat model, attack paths) - в самих фазах и в вёрстке `## Output Format`. Ни один из двух разделов полным форматом по отдельности не является.

## Constraints

- Только security; correctness и производительность - общий ревьюер
- Код не правится, выход это findings-цепочки
- Без достижимого пути атаки находка не выносится
- Маркера accepted risk нет - находка подсвечивается

Делегировать агенту `security-reviewer` с **`mode: interactive`** во входе - без этого поля агент работает как узел (`autonomous`) и отчёт уйдёт handoff-ом наверх, а не пользователю.
