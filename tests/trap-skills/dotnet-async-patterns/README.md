# dotnet-async-patterns: сжатие по свидетельству, группа 2.1

Скилл `dex-skill-dotnet-async-patterns` 2.2.1 ([`inputs/SKILL-2.2.1.md`](inputs/SKILL-2.2.1.md)), эпик #291,
группа 2.1 (#296).

## Заход группы 2.1

Общий для пяти скиллов: `dotnet-async-patterns`, `dotnet-validation`, `dotnet-logging`,
`dotnet-resources`, `dotnet-code-quality`.

**Вход.** Мини-проект [`_projects/billing`](../_projects/billing/README.md#группа-21-net-скиллы-кода),
ветки `branches/<имя>`. Ключ, коды единиц и допустимые решения записаны до первого прогона. Кейсы
набора: G1, G2, RV-A; приманки G0, RV0.

**Исполнитель.** `claude -p`, `--model claude-sonnet-5-5 --effort medium --restricted
--strict-mcp-config --no-session-persistence --disable-slash-commands --permission-mode acceptEdits
--max-budget-usd 3`, инструменты `Read, Write, Edit, Glob, Grep, Bash`, разрешён только `Bash(git *)`
(кодовым кейсам - и `Bash(dotnet *)`). Скилл подан копией `SKILL.md` через `--add-dir`, `Skill` tool
не вызывается.

## Потребители

Skill tool в фазе: `dotnet-coder`, `dotnet-performance-analyst`, `dotnet-runtime-diagnostician`, `architect-dotnet`, `debugger`; by-stack через `stack-registry`: `mr-reviewer`, `mr-check-reviewer`, `self-reviewer`, `discover-reviewer`, `security-reviewer`, `stand-reviewer`, `bug-fixer`. Сноски: `managed-debug`, `completeness-mapping`, `dotnet-logging`. Бандлы: `dotnet-developer`, `dotnet-fullstack`, `runtime-diagnostics`. Кейс активации `dotnet-async-in`.

## Неточности текста

A5 «ненужный async» противоречит AsyncGuidance (prefer async/await над прямым возвратом `Task`): исход подаётся как стоимость стейт-машины, в RV-A это приманка P5.

## Вердикт

Не прогонялся.
