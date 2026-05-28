---
description: Выполнить произвольную последовательность MI2-команд в attached-сессии netcoredbg
user-invocable: true
allowed-tools: Bash
argument-hint: "<PID> --commands \"<mi2-commands>\""
---

# /ncdbg-exec

Низкоуровневая escape-hatch: выполнить произвольную последовательность MI2-команд против running managed процесса.

**Goal:** Дать агенту прямой доступ к MI2-протоколу netcoredbg, когда стандартные команды (attach, launch, dump-stacks) недостаточны для конкретного сценария.

**Output:** Сырой MI2-вывод: `^done`, `^running`, `*stopped`, `=event` строки. Парсинг на стороне вызывающего.

**Scenarios:**

- `--commands "-data-evaluate-expression myVar"` - вычислить managed-выражение в текущем фрейме (требует прохода через `-thread-select` / `-stack-select-frame` сначала)
- `--commands "-break-insert MyApp.cs:42; -exec-continue"` - условный breakpoint без остановки
- `--commands "-var-create v1 * thisRequest"` - inspect managed-объект через variable objects
- `--commands "-list-thread-groups"` - listing запущенных runtime-инстансов в процессе

**Constraints:**

- Команды разделяются `; ` или `\n`, передаются в netcoredbg через `-ex` как отдельные аргументы, не через shell
- Shell-метасимволы (`$()`, backtick, `|`, `&&`, `||`, `>`, `<`) в строке `--commands` запрещены - они означают command injection при формировании bash; для multi-line использовать `--init-eval-command-file`
- MI2 синтаксис (`-thread-info`, не `info threads`); REPL-команды без префикса `-` тоже работают, но менее стабильны
- При `--commands` с побочными эффектами (`-exec-continue`, `-break-delete`) процесс изменяется - применять только для диагностики, не для production
