# REPORT: анализ /work/vendor (статический, файлы подрядчика не запускались)

## Симптом
Подрядчик передал libcalc.so, vendor-tool и Legacy.Pricing.dll без исходников. Файлы недоверенные. Нужно выяснить, что в них есть. Сбоя нет.

## Ответы

### (1) libcalc.so: экспорт и зависимости
Это ELF 64-bit aarch64, stripped, BuildID 81b02408108577763b392b52ddc0b3c722e134fb.

Команда: `docker exec diag46-b1-f2 sh -c 'nm -D -C --defined-only /work/vendor/libcalc.so'`
```
0000000000000740 T tariff::Calculator::version()
00000000000006f0 T tariff::Calculator::surcharge(int, std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> > const&) const
0000000000000750 T calc_api_level
```
Экспортируются две C++-функции и один C-символ:
- `tariff::Calculator::version()`
- `tariff::Calculator::surcharge(int, std::string const&) const`
- `calc_api_level` (C-линковка, без манглинга)

Типы возвращаемых значений в манглинге не кодируются, поэтому они неизвестны.

Зависимости: `readelf -d /work/vendor/libcalc.so | grep -E "NEEDED|RPATH|RUNPATH"` выводит
```
0x0000000000000001 (NEEDED)  Shared library: [libstdc++.so.6]
```
- RPATH и RUNPATH нет.
- Единственный импорт: `std::__cxx11::basic_string<...>::compare(char const*) const@GLIBCXX_3.4.21`. Он нужен `surcharge` для сравнения строки.

### (2) vendor-tool: архитектура и вывод
Команды: `readelf -h`, `file`, `objdump -d`, `objdump -s -j .rodata`
```
Machine: Advanced Micro Devices X86-64   (ELF64, EXEC, statically linked, stripped)
401000: mov $1,%eax; lea 0xff4(%rip),%rsi (=0x402000); mov $0x1a,%edx; mov %rax,%rdi; syscall   # write(1, buf, 26)
401016: mov $0x3c,%eax; mov $0,%edi; syscall                                                  # exit(0)
.rodata 402000: "vendor-tool 2.1 build 884\n"
```
- Бинарь собран для x86-64 (AMD64), а лаборатория работает на aarch64. Нативно он здесь не запустится, нужны эмуляция или x86-хост.
- Он печатает в stdout одну строку `vendor-tool 2.1 build 884` (26 байт с `\n`) и завершается с кодом 0.
- Других действий нет: ни файлов, ни сети, ни чтения окружения. Код состоит из двух syscall (write и exit).
- Библиотек нет, interp-сегмента нет, `strings` ничего подозрительного не показал.

### (3) Legacy.Pricing.Discounts.Apply
Сборка: .NET 8 (PE32 .NET assembly, версия 1.0.0.0). Декомпиляция: `ilspycmd /work/vendor/Legacy.Pricing.dll`
```csharp
private const decimal LoyaltyRate = 0.0725m;
public static decimal Apply(decimal amount, string tier)
{
    if (Environment.GetEnvironmentVariable("PRICING_TIER_OVERRIDE") == "ignore-tier")
        return amount;
    if (!(tier == "gold"))
        return amount * 0.9275m;
    return amount * 0.8550m;
}
```
Метод работает так:
- **Переменная окружения:** `PRICING_TIER_OVERRIDE`. Если она равна ровно `ignore-tier`, скидка не применяется и возвращается `amount` без изменений. Это обход скидки через окружение, и он действует для любого `tier`.
- **tier == "gold":** результат `amount * 0.8550m`, то есть скидка 14,5% (2 × 0,0725).
- **Любой другой tier:** результат `amount * 0.9275m`, то есть скидка 7,25% (`LoyaltyRate`).
- Сравнение с `"gold"` чувствительно к регистру. `Gold` и `GOLD` получат ставку 7,25%.
- Константа `LoyaltyRate` в самом методе не используется, ставки зашиты литералами.
- Побочных эффектов нет: ни I/O, ни сети.

## Что предлагаю
- Не запускать файлы подрядчика на проде без проверки. Статический разбор показал, что вредоносного кода нет, но исходников нет. Попросить у подрядчика исходники и подпись или хэши релиза.
- libcalc.so: убедиться, что на целевом хосте есть libstdc++ с GLIBCXX_3.4.21 и новее, и что хост aarch64. Уточнить у подрядчика сигнатуры `version`, `surcharge` и `calc_api_level`, потому что по манглингу возвращаемые типы не видны.
- vendor-tool: запрашивать сборку под aarch64. Если нужна именно эта, запускать только в изолированном контейнере или эмуляторе.
- Legacy.Pricing: выяснить, зачем нужен обход `PRICING_TIER_OVERRIDE=ignore-tier`. В проде эту переменную нужно запретить или проверять её отсутствие в окружении сервиса. Регистр `tier` согласовать с вызывающим кодом. Ставки вынести в конфигурацию.
