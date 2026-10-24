---
name: core-dumps
description: Post-mortem анализ coredump - gcore live snapshot, coredumpctl, ulimit, kernel.core_pattern, mismatched libs, контейнеры. Активируется при core dump, coredumpctl, gcore, ulimit, core_pattern, post-mortem, sigsegv abort, container coredump, systemd-coredump, sysroot
---

# Core dumps - ловушки сбора и анализа post-mortem

## Запись coredump

### ulimit -c не наследуется
Плохо: `ulimit -c unlimited` в одном shell, потом запуск процесса в другом shell, ожидание дампа
Правильно: `ulimit -c unlimited` в том же shell где стартует процесс, либо `LimitCORE=infinity` в systemd unit
Почему: ulimit - per-process, наследуется только дочерними. Запустили процесс через systemd / docker / другой shell - ваш ulimit не действует

### core_pattern переопределяет местоположение
Плохо: ждать `core` в текущей директории на современной Ubuntu / Fedora
Правильно: `cat /proc/sys/kernel/core_pattern` - часто `|/lib/systemd/systemd-coredump %p ...`; дампы извлекаются через `coredumpctl dump <PID|name>`
Почему: дистрибутивы используют named-pipe handler для systemd-coredump. Файлы `core` в pwd не создаются, агент думает что дамп не сохранился

### coredump_filter режет shared memory
Плохо: дамп есть, но `info shared` показывает «no shared library symbols» - mmap-ed файлы не сохранены
Правильно: `echo 0xff > /proc/<PID>/coredump_filter` (все типы памяти); проверить через `cat /proc/<PID>/coredump_filter`
Почему: filter определяет какие сегменты VM попадают в дамп. Дефолт исключает shared mmap. Для .NET / Java с большой heap-mmap это критично

## gcore и coredumpctl

### gcore блокирует процесс
Плохо: `gcore <PID>` на prod-сервисе с 8GB heap во время инцидента
Правильно: понимать что gcore делает stop+ptrace+write всех страниц RAM; multi-GB = секунды-минуты остановки, health-check может зафейлиться; для .NET использовать `dotnet-dump collect` (менее блокирующе через diagnostic port)
Почему: gcore через ptrace останавливает процесс на время записи. Размер дампа = RES процесса в худшем случае

### coredumpctl list не показывает старые дампы
Плохо: ожидать что дамп от вчерашнего инцидента доступен через `coredumpctl list`
Правильно: проверить `journalctl --since="24 hours ago" -u systemd-coredump` и `/etc/systemd/coredump.conf` - `MaxUse=` и `MaxFileSize`; настройка `Storage=external` сохраняет в `/var/lib/systemd/coredump/`
Почему: systemd-coredump имеет лимиты ротации. Старые дампы удаляются автоматически; конфиг определяет окно хранения

### debug gdb через coredumpctl
Плохо: вручную копировать дамп и подключать gdb
Правильно: `coredumpctl debug <PID>` или `coredumpctl debug <executable-name>` - запускает gdb с правильными путями и symbol mapping
Почему: coredumpctl знает где лежат сжатые дампы (`.zst`), executable путь, и подсовывает gdb готовый setup

## Анализ на другой машине и контейнеры

### Анализ дампа на другой машине
Плохо: дамп с prod (Ubuntu 22.04, glibc 2.35), gdb на dev (Ubuntu 24.04, glibc 2.39) - backtrace внутри libc =`??`
Правильно: `set sysroot /path/to/prod-rootfs` (rsync целевой rootfs); либо docker run с base image прода, mount дампа, gdb внутри
Почему: gdb загружает символы из локальных `.so`, версии не совпадают - адреса смещены, frame внутри libc - мусор

### core_pattern named-pipe host-only
Плохо: настроить `core_pattern` внутри контейнера и ожидать что host увидит
Правильно: `core_pattern` глобальный sysctl, действует только на host; внутри контейнера запись `|/path/handler` бесполезна; решение - `core_pattern=/dumps/core.%e.%p` плюс mount tmpfs в контейнер
Почему: sysctl `/proc/sys/kernel/core_pattern` - shared kernel resource, не namespaced. Контейнерное изменение игнорируется

### Symbols для post-mortem контейнера
Плохо: дамп взят с продового container image, analyze без image
Правильно: `docker save prod-image -o image.tar` + tar extract = rootfs; `set sysroot` на этот rootfs в gdb; для .NET - `dotnet-symbol --recurse-subdirectories <dump>` подкачает managed PDBs
Почему: container image содержит точный набор библиотек. Без него mismatched libs гарантирован

> Managed-side анализ дампа через SOS-команды (clrstack, dumpasync, dumpheap) - см. dex-skill-managed-debug.
> GDB и LLDB batch-mode для разбора native-дампа - см. dex-skill-native-debug.
