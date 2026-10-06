# dotnet-logging: сжатие по свидетельству, группа 2.1

Скилл `dex-skill-dotnet-logging` 2.4.1 ([`inputs/SKILL-2.4.1.md`](inputs/SKILL-2.4.1.md)), эпик #291,
группа 2.1 (#296).

## Заход группы 2.1

Общий для пяти скиллов: `dotnet-async-patterns`, `dotnet-validation`, `dotnet-logging`,
`dotnet-resources`, `dotnet-code-quality`.

**Вход.** Мини-проект [`_projects/billing`](../_projects/billing/README.md#группа-21-net-скиллы-кода),
ветки `branches/<имя>`. Ключ, коды единиц и допустимые решения записаны до первого прогона. Кейсы
набора: RV-L1, RV-L2, L14/L11 в G1 и G2; приманки G0, RV0.

**Исполнитель.** `claude -p`, `--model claude-sonnet-5-5 --effort medium --restricted
--strict-mcp-config --no-session-persistence --disable-slash-commands --permission-mode acceptEdits
--max-budget-usd 3`, инструменты `Read, Write, Edit, Glob, Grep, Bash`, разрешён только `Bash(git *)`
(кодовым кейсам - и `Bash(dotnet *)`). Скилл подан копией `SKILL.md` через `--add-dir`, `Skill` tool
не вызывается.

## Потребители

Skill tool в фазе: `dotnet-coder`, `dotnet-ef-specialist`, `dotnet-performance-analyst`, `dotnet-runtime-diagnostician`, `architect-dotnet`, `seq-logging-specialist`, `security-reviewer`, `debugger`; by-stack через `stack-registry`: ревьюеры, `bug-fixer`. Сноска: `managed-debug`. Бандлы: `dotnet-developer`, `dotnet-fullstack`, `runtime-diagnostics`, `infrastructure`, `devops`. Кейс активации `dotnet-logging-in`.

## Неточности текста

L4: «категория Default» у негенерного логгера неточна - категория задаётся строкой `CreateLogger`, дефект в произвольном имени. Свод `main` RUL-0004 (`Proposed`) дублирует L1, L2, L4.

## Вердикт

Не прогонялся.
