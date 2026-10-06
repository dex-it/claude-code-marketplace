# dotnet-code-quality: сжатие по свидетельству, группа 2.1

Скилл `dex-skill-dotnet-code-quality` 1.1.1 ([`inputs/SKILL-1.1.1.md`](inputs/SKILL-1.1.1.md)), эпик #291,
группа 2.1 (#296).

## Заход группы 2.1

Общий для пяти скиллов: `dotnet-async-patterns`, `dotnet-validation`, `dotnet-logging`,
`dotnet-resources`, `dotnet-code-quality`.

**Вход.** Мини-проект [`_projects/billing`](../_projects/billing/README.md#группа-21-net-скиллы-кода),
ветки `branches/<имя>`. Ключ, коды единиц и допустимые решения записаны до первого прогона. Кейсы
набора: G4, RV-Q; приманки G0.

**Исполнитель.** `claude -p`, `--model claude-sonnet-5-5 --effort medium --restricted
--strict-mcp-config --no-session-persistence --disable-slash-commands --permission-mode acceptEdits
--max-budget-usd 3`, инструменты `Read, Write, Edit, Glob, Grep, Bash`, разрешён только `Bash(git *)`
(кодовым кейсам - и `Bash(dotnet *)`). Скилл подан копией `SKILL.md` через `--add-dir`, `Skill` tool
не вызывается.

## Потребители

Skill tool в фазе: `dotnet-coder`, `dotnet-quality-auditor`, `architect-dotnet`; by-stack через `stack-registry`: ревьюеры. Пересечение с `project-baseline` (Q1, Q3, Q14). Бандлы: `dotnet-developer`, `dotnet-fullstack`. Кейс активации `dotnet-code-quality-in`.

## Неточности текста

Q10: `dotnet list package --vulnerable` выходит с кодом 0 и при находке - гейт требует разбора вывода или `--format json`. Q12 подтверждено: NSDEPCOP03 (нет `config.nsdepcop`) в обычном выводе сборки не виден.

## Вердикт

Не прогонялся.
