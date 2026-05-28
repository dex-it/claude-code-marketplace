---
description: Дамп managed call-stacks всех потоков процесса в JSON-структуре для парсинга агентом
user-invocable: true
allowed-tools: Bash
argument-hint: "<PID>"
---

# /ncdbg-dump-stacks

Снять snapshot всех managed-стеков процесса и вернуть в JSON-структуре, удобной для парсинга агентом.

**Goal:** Получить programmatic-friendly representation managed-state процесса для диагностики hang, deadlock, ThreadPool starvation.

**Output:** JSON массив объектов вида `{ "threadId": 12, "name": "Worker-1", "frames": [{ "function": "...", "assembly": "...", "file": "...", "line": 42 }, ...] }`. Threads без managed-кадров (pure native) показаны с пустым `frames: []`.

**Scenarios:**

- Прод-сервис hang - dump-stacks показывает все managed-потоки, фильтр по `frames[].function ~ "Wait\|Result\|Lock"` локализует deadlock-кандидатов
- ThreadPool starvation - агрегация по уникальным top-кадрам показывает «все воркеры в одной функции»
- Quick health-check - просто число managed-threads и их состояния
- Процесс не managed (no `.NET runtime detected`) - возвращается пустой массив с warning

**Scenarios под капотом (для понимания, не для пользователя):**

- attach -> `-exec-interrupt` -> `-thread-info` -> для каждого `thread-id` `-stack-list-frames` -> detach
- JSON собирается на стороне команды, не выдаётся netcoredbg напрямую (он MI2)

**Constraints:**

- `netcoredbg` обязателен, ptrace permissions нужны
- Команда блокирует процесс на 0.5-2 секунды (stop-the-world для all-threads snapshot)
- Для огромного thread-count (>1000) - неэффективно; использовать `dotnet-stack report` через diagnostic port
- JSON-вывод стабилен по схеме, но имена полей могут уточняться в minor-версиях этой команды (semver bundle)
