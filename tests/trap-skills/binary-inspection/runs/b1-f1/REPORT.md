## Симптом

Подрядчик передал недоверенные файлы без исходников: /work/vendor/{libcalc.so, vendor-tool, Legacy.Pricing.dll}. Нужно понять, что они экспортируют, для какой архитектуры собраны и что делают. Анализ только статический: vendor-tool, libcalc.so и dll не запускались и не загружались.

## Ответы

### (1) libcalc.so: экспорт и зависимости

Файл: ELF 64-bit aarch64, stripped. BuildID 81b02408108577763b392b52ddc0b3c722e134fb.

Экспортируемые функции (читаемые имена):
- `tariff::Calculator::version()`
- `tariff::Calculator::surcharge(int, std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char>> const&) const`
- `calc_api_level` (C-символ, без манглинга)

Зависимости (NEEDED): только `libstdc++.so.6`. RPATH/RUNPATH нет.

Улики:
```
$ docker exec diag46-b1-f1 nm -D --defined-only -C /work/vendor/libcalc.so
0000000000000740 T tariff::Calculator::version()
00000000000006f0 T tariff::Calculator::surcharge(int, std::__cxx11::basic_string<...> const&) const
0000000000000750 T calc_api_level
$ docker exec diag46-b1-f1 readelf -d /work/vendor/libcalc.so | grep NEEDED
 0x0000000000000001 (NEEDED)             Shared library: [libstdc++.so.6]
```

### (2) vendor-tool: архитектура и вывод

Собран под x86-64 (ELF64 EXEC, Machine: AMD X86-64), статически, stripped. Контейнер aarch64, поэтому нативно он здесь не запустится. Запускать его я и не стал.

Печатает строку `vendor-tool 2.1 build 884` с переводом строки (26 байт) в stdout и завершается с кодом 0. Других действий нет: ни файлов, ни сети, ни чтения аргументов. Это видно по дизассемблированию всего `.text`, там два syscall.

Улики:
```
$ docker exec diag46-b1-f1 file /work/vendor/vendor-tool
ELF 64-bit LSB executable, x86-64, statically linked, stripped
$ docker exec diag46-b1-f1 objdump -d /work/vendor/vendor-tool
  401000: mov $0x1,%eax          # write
  401005: lea 0xff4(%rip),%rsi   # 0x402000 (.rodata)
  40100c: mov $0x1a,%edx         # 26 байт
  401014: syscall
  401016: mov $0x3c,%eax         # exit
  40101b: mov $0x0,%edi          # код 0
  401020: syscall
$ docker exec diag46-b1-f1 strings -a /work/vendor/vendor-tool
vendor-tool 2.1 build 884
```

### (3) Legacy.Pricing.Discounts.Apply(decimal amount, string tier)

Сборка .NET 8 (ilspycmd, статическая декомпиляция).

Логика:
1. Если переменная окружения `PRICING_TIER_OVERRIDE` равна `ignore-tier`, возвращается `amount` без скидки.
2. Иначе, если `tier == "gold"`, возвращается `amount * 0.8550m`, то есть скидка 14,5%. Это 1 − 2×`LoyaltyRate`.
3. Иначе возвращается `amount * 0.9275m`, то есть скидка 7,25%. Это 1 − `LoyaltyRate`.

Ставка: `LoyaltyRate = 0.0725m` (7,25%).

Улика:
```
$ docker exec diag46-b1-f1 ilspycmd /work/vendor/Legacy.Pricing.dll
private const decimal LoyaltyRate = 0.0725m;
public static decimal Apply(decimal amount, string tier) {
  if (Environment.GetEnvironmentVariable("PRICING_TIER_OVERRIDE") == "ignore-tier") return amount;
  if (!(tier == "gold")) return amount * 0.9275m;
  return amount * 0.8550m;
}
```

## Что предлагаешь

- До принятия не запускать vendor-tool и не загружать libcalc.so и dll в прод. Потребовать у подрядчика исходники или подписанные сборки и проверить SHA-256 файлов.
- `PRICING_TIER_OVERRIDE=ignore-tier` отключает скидки целиком. Это недокументированный переключатель. Запретить эту переменную в конфигурации окружений или явно согласовать с подрядчиком.
- В `Apply` скидка 7,25% действует для любого `tier`, кроме `gold`, включая null и опечатки. Уточнить, так ли это задумано.
- vendor-tool собран под x86-64. На aarch64 его нужно запускать только в изолированном эмуляторе (qemu-user) и без сети. Статический анализ показал безвредное поведение.
- libcalc.so собран под aarch64, архитектура совпадает с лабораторией. Перед использованием проверить ABI `std::__cxx11::string` и версию libstdc++ на целевой системе.
