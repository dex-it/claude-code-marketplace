---
name: binary-inspection
description: Бинарный анализ - binutils (readelf, nm, objdump, addr2line, strings, ldd, c++filt), Rizin JSON output, LIEF Python API, ilspycmd .NET decompiler, build-id и SourceLink. Активируется при readelf, objdump, nm, ldd, strings, addr2line, c++filt, rizin, rz-pipe, ilspycmd, lief, build-id, dynamic symbols, dwarf info, ELF, PE, Mach-O
---

# Binary inspection - ловушки статического анализа бинарей

## binutils-основы

### ldd на untrusted бинаре
Плохо: `ldd unknown_binary` для проверки зависимостей
Правильно: `readelf -d unknown_binary | grep NEEDED` для безопасной проверки
Почему: ldd работает через `LD_TRACE_LOADED_OBJECTS=1` плюс exec бинаря; вредоносный binary может выполнить код через preloaded interpreter. readelf - чистое чтение ELF

### nm без -D на stripped binary
Плохо: `nm binary` на stripped .so - пустой вывод, agent делает вывод «нет символов»
Правильно: `nm -D binary` для динамических символов; на полностью stripped - `objdump -T` для exports
Почему: nm без -D читает только static-symbols, которые strip удалил. Dynamic symbols (exports) сохраняются всегда - они нужны для linker resolve

### file vs readelf для типа
Плохо: верить `file` для архитектуры бинаря
Правильно: `readelf -h binary` - точный header с Machine, Class, Endianness
Почему: file делает best-effort detection по магическим числам; для cross-compiled или embedded может вводить в заблуждение

## addr2line и символизация

### addr2line без `-e` и `-f`
Плохо: `addr2line 0x7fff1234abcd` ожидать file:line - error «no file»
Правильно: `addr2line -e <binary> -f -C 0xADDR` (executable, function name, demangle)
Почему: addr2line требует binary через `-e`; без `-f` нет имени функции; без `-C` C++ symbols не демангнуты

### Адрес в дампе vs runtime
Плохо: брать адрес из gdb «0x7f5a...», передавать в addr2line напрямую
Правильно: для PIE binary вычитать ASLR base (`info proc mappings` в gdb); для shared library - смещение относительно base address `.so`
Почему: addr2line работает с file-offset в ELF, не с runtime virtual address. PIE и ASLR смещают base случайно

### c++filt vs rustfilt vs swift demangle
Плохо: использовать только `c++filt` для всех языков
Правильно: C++ -> `c++filt`; Rust -> `rustfilt` (`cargo install rustfilt`); Swift -> `swift demangle`; D -> `ddemangle`
Почему: ABI mangling схемы разные. C++ Itanium ABI != Rust mangling != Swift name mangling. c++filt оставит Rust имена нечитаемыми

## Rizin scripted

### REPL вместо headless
Плохо: запуск `rizin binary` для анализа в скрипте
Правильно: `rizin -qc 'iIj; ii~~import; pdfj @main' binary` (quiet, command chain, JSON output `j`-suffix)
Почему: rizin interactive REPL ожидает stdin. `-q` для quiet, `-c` для команд - headless mode для агента

### rz-pipe для Python pipeline
Плохо: парсить output rizin через regex
Правильно: `pip install rzpipe`; `r = rzpipe.open("binary"); info = r.cmdj("iIj")` - возвращает dict
Почему: rz-pipe - официальный API binding к rizin core; вывод JSON напрямую в native структуры, без парсинг-ошибок

## LIEF Python API

### LIEF для патчинга ELF/PE
Плохо: писать свой парсер ELF/PE для модификации (добавление section, замена символа)
Правильно: `import lief; binary = lief.parse("path"); binary.add_section(...)`; работает с ELF/PE/Mach-O единым API
Почему: LIEF поддерживает кросс-формат, активно мейнтейнится (2026), Apache-2.0; собственный парсер - source of bugs

### LIEF vs Rizin по сценарию
Плохо: использовать Rizin для batch-патчинга 100 бинарей в CI
Правильно: LIEF для programmatic мутаций (patching, signing, repacking); Rizin для исследовательского анализа (disassembly, reverse engineering)
Почему: LIEF designed для modification, parsing-fast; Rizin тяжелее, но даёт interactive analysis + decompilation

## ilspycmd для .NET

### ILSpy GUI vs ilspycmd
Плохо: рекомендовать «открой в ILSpy» когда нет GUI
Правильно: `dotnet tool install --global ilspycmd`; `ilspycmd -d Assembly.dll` для full decompile или `-il Assembly.dll` для IL
Почему: ilspycmd - CLI wrapper над ICSharpCode.Decompiler; agent-friendly; работает Linux/macOS/Windows

### Obfuscated assemblies
Плохо: ожидать читаемого вывода ilspycmd на obfuscated коде
Правильно: для obfuscated сначала de4dot или dnSpyEx для deobfuscation (Windows), потом ilspycmd; либо принять что имена нечитаемые
Почему: ilspycmd не делает deobfuscation. Имена `a.b.c()` остаются как есть, IL читается, но смысл потерян

## Build-id и matching

### debug-info без проверки build-id
Плохо: подкинули `app.debug` для analyze дампа без проверки соответствия
Правильно: `readelf -n binary | grep -A1 'Build ID'` и `readelf -n binary.debug | grep -A1 'Build ID'` - должны совпадать
Почему: mismatch build-id даёт «правдоподобный» backtrace с неверными строками. GDB не предупреждает явно

### debuginfod fallback
Плохо: вручную выкачивать `.debug` файлы для каждого binary
Правильно: `export DEBUGINFOD_URLS="https://debuginfod.ubuntu.com"`; addr2line, gdb, eu-stack автоматически тянут по build-id
Почему: debuginfod - распределённый кэш debug-info, поддерживается binutils 2.34+, gdb 10.1+; экономит ручную работу

## strings и cross-arch

### strings без -e на Windows-бинаре
Плохо: `strings windows.exe` показывает мусор для UTF-16 строк
Правильно: `strings -e l windows.exe` (little-endian 16-bit); `-e b` для big-endian; `-a` для всего файла
Почему: дефолтный strings ищет ASCII 7-bit. Windows строки часто UTF-16; без `-e l` они не видны

### objdump для cross-arch без --target
Плохо: `objdump -d arm64-binary.so` на x86_64 машине - неверный disassembly
Правильно: `objdump --target=elf64-aarch64-little -d arm64-binary.so`; либо `aarch64-linux-gnu-objdump`
Почему: objdump без `-target` использует host architecture для decode. Для cross-arch нужен явный target или cross-binutils
