# dex-codebase-analyzer

Утилита для быстрого анализа репозитория во время архитектурных сессий и онбординга. Используется агентами `dex-architect` / `dex-architect-dotnet` в Phase 0 (Codebase Priming) и любыми пользователями, которым нужно быстро понять контекст незнакомого кода.

## Команды

| Команда | Что делает | Когда использовать |
|---------|------------|--------------------|
| `/codebase-summary` | Компактный обзор: стек, размер (LoC), top-level директории, architecture style | Перед архитектурной сессией; при онбординге в новое репо |
| `/codebase-graph` | Граф зависимостей модулей/проектов в Mermaid + текстовый список | Перед рефакторингом; при поиске циклических зависимостей |
| `/codebase-pack` | Упаковка репо в один файл-артефакт через `repomix` | **Только для передачи во внешние LLM** (ChatGPT, Gemini); не нужно для Claude Code-агентов |

## Recommended tools (set up for best experience)

Все CLI-инструменты опциональные — команды работают на fallback'ах через встроенные Read/Glob/Grep, но **с CLI результат точнее и быстрее**. Установите один раз для всех команд:

```bash
# scc — точные метрики LoC + COCOMO (10-100× быстрее find+wc)
brew install scc                          # macOS
sudo apt install scc                      # Debian/Ubuntu (через cargo при отсутствии в repos)
cargo install scc                         # любая ОС с Rust toolchain
scoop install scc                         # Windows (Scoop)

# ast-grep — структурный поиск по AST (точнее grep для multi-line patterns)
brew install ast-grep                     # macOS
cargo install ast-grep                    # любая ОС с Rust toolchain
npm install -g @ast-grep/cli              # Node.js окружение

# repomix — упаковка репо для передачи во внешние LLM
npm install -g repomix
# или одноразово: npx -y repomix

# madge — circular dependencies + граф импортов для TypeScript/JavaScript
npm install -g madge

# dependency-cruiser — расширенный граф deps для TS/JS с правилами
npm install -g dependency-cruiser

# pydeps — графы модулей для Python
pip install pydeps

# dotnet list — зависимости для .NET (входит в SDK, ставить отдельно не нужно)
dotnet --version                          # проверить установку
```

## Поведение при отсутствии зависимостей

Все команды делают graceful fallback на встроенные tools Claude Code:

- **`scc` нет:** `/codebase-summary` использует `find` + `wc -l` по основным расширениям. Менее точно (не различает code/comments/blank), но достаточно для обзора порядков величин.
- **`repomix` нет:** `/codebase-pack` показывает инструкцию установки. Ручная сборка не предлагается — для упаковки всего репо в один файл нерационально делать через chain Read.
- **Графовых CLI нет:** `/codebase-graph` использует `grep` по `import` / `using` / `require` — грубый граф (без транзитивных зависимостей и анализа dynamic imports), но рабочий для первичной оценки.

## Зависимости — короткая справочная таблица

| CLI | Назначение | Источник |
|-----|------------|----------|
| [`scc`](https://github.com/boyter/scc) | Быстрый подсчёт LoC, COCOMO-оценка | Go-бинарник |
| [`ast-grep`](https://ast-grep.github.io/) | Структурный поиск по AST | Rust-бинарник |
| [`repomix`](https://github.com/yamadashy/repomix) | Упаковка репо в LLM-формат | Node.js |
| [`madge`](https://github.com/pahen/madge) | Circular deps для TS/JS | Node.js |
| [`dependency-cruiser`](https://github.com/sverweij/dependency-cruiser) | Граф deps + правила для TS/JS | Node.js |
| [`pydeps`](https://github.com/thebjorn/pydeps) | Граф модулей для Python | Python |
| [`dotnet list`](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-list-package) | Зависимости для .NET | .NET SDK |

## Где плагин полезен

- В фазе **Codebase Priming** агентов-архитекторов перед проектированием новой фичи
- При **онбординге** в незнакомый репозиторий (быстрое понимание организации)
- Для **архитектурного review** существующего кода (поиск циклических зависимостей)
- При подготовке к **миграции** или большому рефакторингу — нужен граф «что от чего зависит»
- Для **передачи snapshot репо во внешний LLM** (только `/codebase-pack`, не для Claude Code-агентов)

## Что плагин НЕ делает

- Не делает security-сканирование (для этого `dex-skill-owasp-security` + `dex-architect`)
- Не делает performance-профилирование (для этого `dex-dotnet-performance`)
- Не пишет ADR / документы (для этого `dex-adr-writer`)
- Не оценивает качество кода (для этого `dex-dotnet-reviewer` и аналоги)

Это **point tool** для быстрого получения контекста. Глубокий анализ — задача специалистов.
