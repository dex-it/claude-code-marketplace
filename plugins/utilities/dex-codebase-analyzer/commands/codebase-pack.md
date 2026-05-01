---
description: Упаковать репозиторий в LLM-friendly артефакт через repomix
allowed-tools: Bash, Read
argument-hint: "[--output path] [--include glob] [--exclude glob]"
---

# /codebase-pack

Собрать concise representation репозитория для последующей передачи агентам/Claude в качестве контекста.

**Goal:** Получить один файл-артефакт с упакованным содержимым репозитория, готовый к передаче в LLM-prompt (с учётом token-budget).

**Output:** Путь к собранному артефакту + метрики (примерное число токенов, размер, что включено/исключено).

**Scenarios:**

- По умолчанию: `repomix` со встроенной tree-sitter compression + сжатый markdown
- `--output path` — кастомный путь файла
- `--include glob` / `--exclude glob` — переопределить дефолтные фильтры
- Если `repomix` не установлен — вывести инструкцию (`npm install -g repomix` или `npx -y repomix`) и предложить ручной fallback: упаковать вручную через chain `find`+`Read` для критичных файлов

**Constraints:**

- Не упаковывать `node_modules`, `bin`, `obj`, `dist`, `.git`, `*.lock`, бинарники по умолчанию
- Если репозиторий > 100k LoC и пользователь не передал `--include` — предупредить про размер артефакта
- Не запускать `repomix` без подтверждения, если он создаст файл > 5MB
