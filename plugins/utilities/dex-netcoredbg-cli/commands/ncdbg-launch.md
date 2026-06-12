---
description: Запустить managed .NET assembly под отладкой netcoredbg, break на unhandled exception
user-invocable: true
allowed-tools: Bash
argument-hint: "<dll-path> [-- <app-args>]"
---

# /ncdbg-launch

Запустить .NET assembly под управлением netcoredbg, остановиться на первом unhandled exception или main entry.

**Goal:** Воспроизвести краш или non-trivial запуск под отладчиком и зафиксировать первое событие (load, exception, breakpoint).

**Output:** Лог событий MI2: библиотеки загружены, точка остановки, тип события, stack trace в момент остановки. Exit code процесса при выходе.

**Scenarios:**

- `<dll-path>` без args - стандартный launch с `-exec-run`, остановка на entry или первой unhandled exception
- `<dll-path> -- <args>` - args передаются процессу через MI2 `-gdb-set args`
- Файл не существует или не managed assembly - вывести `file <dll-path>` диагностику
- Процесс завершается raise() / abort() - снять backtrace до завершения, exit code дампится

**Constraints:**

- `netcoredbg` в PATH, версия совместима с runtime для assembly
- Assembly должна быть скомпилирована для совместимого runtime (`dotnet --info`)
- Stdin / stdout процесса перенаправлены через debugger - интерактивный ввод не работает
- Для воспроизведения именно прод-условий зафиксировать env-переменные (`DOTNET_*`, ASPNETCORE_ENVIRONMENT, LANG)
