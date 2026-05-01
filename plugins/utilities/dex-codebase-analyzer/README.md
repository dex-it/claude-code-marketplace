# dex-codebase-analyzer

Утилита для быстрого анализа репозитория во время архитектурных сессий. Используется агентами `dex-architect` / `dex-architect-dotnet` в Phase 0 (Codebase Priming) и любыми пользователями, которым нужно быстро понять контекст незнакомого кода.

## Команды

| Команда | Что делает |
|---------|------------|
| `/codebase-summary` | Компактный обзор: стек, размер (LoC), top-level директории, architecture style |
| `/codebase-pack` | Упаковка репо в один LLM-friendly артефакт (через `repomix`) |
| `/codebase-graph` | Граф зависимостей модулей/проектов в Mermaid + текстовый список |

## Зависимости (опциональные)

Все CLI-инструменты опциональные — команды делают graceful fallback на встроенные tools Claude Code (Read/Glob/Grep), если CLI недоступны.

| CLI | Назначение | Установка |
|-----|------------|-----------|
| [`scc`](https://github.com/boyter/scc) | Быстрый подсчёт LoC, COCOMO-оценка | `brew install scc` / `go install github.com/boyter/scc/v3@latest` |
| [`repomix`](https://github.com/yamadashy/repomix) | Упаковка репо в LLM-формат | `npm install -g repomix` или `npx -y repomix` |
| [`ast-grep`](https://ast-grep.github.io/) | Структурный поиск по AST | `brew install ast-grep` / `cargo install ast-grep` |
| `madge` / `dependency-cruiser` | Граф импортов для TS/JS | `npm install -g madge` |
| `pydeps` | Граф модулей для Python | `pip install pydeps` |
| `dotnet list` | Зависимости для .NET | входит в .NET SDK |

## Поведение при отсутствии зависимостей

- **`scc` нет:** `/codebase-summary` использует `find` + `wc -l` по основным расширениям. Менее точно, но достаточно для обзора.
- **`repomix` нет:** `/codebase-pack` показывает инструкцию установки и предлагает ручную сборку через chain `Read` критичных файлов.
- **Графовых CLI нет:** `/codebase-graph` использует `grep` по `import`/`using`/`require` — грубый граф, но рабочий для первичной оценки.

## Где плагин полезен

- В фазе **Codebase Priming** агентов-архитекторов перед проектированием новой фичи
- При **онбординге** в незнакомый репозиторий (быстрое понимание организации)
- Для **архитектурного review** существующего кода (поиск циклических зависимостей)
- При подготовке к **миграции** или большому рефакторингу — нужен граф «что от чего зависит»

## Что плагин НЕ делает

- Не делает security-сканирование (для этого `dex-skill-owasp-security` + `dex-architect`)
- Не делает performance-профилирование (для этого `dex-dotnet-performance`)
- Не пишет ADR / документы (для этого `dex-adr-writer`)
- Не оценивает качество кода (для этого `dex-dotnet-reviewer` и аналоги)

Это **point tool** для быстрого получения контекста. Глубокий анализ — задача специалистов.
