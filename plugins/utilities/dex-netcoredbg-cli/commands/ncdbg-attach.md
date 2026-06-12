---
description: Attach к managed .NET процессу через netcoredbg MI2, дамп managed-стеков всех потоков
user-invocable: true
allowed-tools: Bash
argument-hint: "<PID> [--just-my-code on|off]"
---

# /ncdbg-attach

Attach к managed .NET процессу и снять managed stack trace всех потоков через MI2-протокол netcoredbg.

**Goal:** Получить snapshot всех managed-потоков работающего .NET процесса без остановки на длительное время.

**Output:** Текстовый список потоков с managed call-stack каждого. Для каждого фрейма - assembly, тип, метод, file:line при наличии PDB.

**Scenarios:**

- Без флагов - attach с `just-my-code off`, дамп через `-exec-interrupt`, `-thread-info`, `-stack-list-frames` на каждый thread, detach
- `--just-my-code on` - дамп только пользовательских кадров, framework-фреймы скрыты (для быстрого скана прод-хэнга)
- PID не существует - вывести `ps -p <PID>` диагностику и завершить с error
- ptrace отказано - проверить `/proc/sys/kernel/yama/ptrace_scope` и `CapEff`, дать рекомендацию

**Constraints:**

- `netcoredbg` обязательно в PATH (`./install-bundle/install-cli-tools.sh netcoredbg`)
- На Linux требует CAP_SYS_PTRACE либо `ptrace_scope=0`; в контейнере - `--cap-add=SYS_PTRACE`
- Версия netcoredbg должна соответствовать major-версии установленного .NET runtime - иначе segfault внутри отладчика
- Attach занимает 1-3 секунды; для CRITICAL prod-инцидента предпочесть dotnet-dump collect (через diagnostic port, менее блокирующе)
