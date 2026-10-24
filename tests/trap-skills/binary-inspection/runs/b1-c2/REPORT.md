# Разбор /work/vendor (статический анализ, файлы подрядчика не запускались)

## Симптом
Подрядчик передал бинарники без исходников; нужно выяснить, что они содержат и делают.

## Ответы

### (1) libcalc.so
ELF 64-bit, ARM aarch64, stripped. Команда: `nm -D --defined-only -C libcalc.so`
```
0000000000000740 T tariff::Calculator::version()
00000000000006f0 T tariff::Calculator::surcharge(int, std::__cxx11::basic_string<char, ...> const&) const
0000000000000750 T calc_api_level
```
C++-функции: `tariff::Calculator::version()` и `tariff::Calculator::surcharge(int, std::string const&) const`. Ещё экспортируется `calc_api_level` (не C++-манглированная, C-функция).
Зависимости: `readelf -d libcalc.so | grep NEEDED` -> `Shared library: [libstdc++.so.6]` (только она).

### (2) vendor-tool
`file` / `readelf -h`: ELF 64-bit, **x86-64** (Machine: Advanced Micro Devices X86-64), статически слинкован, stripped. Контейнер aarch64, поэтому нативно не запустится (нужна эмуляция, например qemu-user).
Печатает (по `strings -a vendor-tool`, без запуска): `vendor-tool 2.1 build 884`. Это вывод из статических строк, не наблюдение запуска.

### (3) Legacy.Pricing.Discounts.Apply
Управляемая сборка .NET (target net8.0), декомпиляция `ilspycmd Legacy.Pricing.dll`:
```
public static decimal Apply(decimal amount, string tier)
  if (Environment.GetEnvironmentVariable("PRICING_TIER_OVERRIDE") == "ignore-tier") return amount;
  if (!(tier == "gold")) return amount * 0.9275m;
  return amount * 0.8550m;
```
- Переменная окружения: `PRICING_TIER_OVERRIDE`; при значении `ignore-tier` скидка не применяется, возвращается исходная сумма.
- Иначе для tier == "gold": ставка 0.8550 (скидка 14,5%); для любого другого tier: 0.9275 (скидка 7,25%, равна константе `LoyaltyRate = 0.0725m`, которая в коде сама не используется).
- Исход: возвращается `decimal` — сумма после скидки. Сети, файлов и процессов метод не трогает.

## Улики
Команды и выводы приведены в разделах выше. Дополнительно: `file` определил libcalc.so как aarch64, vendor-tool как x86-64, Legacy.Pricing.dll как PE32 .NET assembly.

## Что предлагаю
- libcalc.so подходит для этого хоста (aarch64); vendor-tool на нём не запустится — запросить у подрядчика aarch64-сборку или запускать только в изолированной эмуляции.
- Файлы недоверенные: не запускать на проде без песочницы. Попросить исходники или подтверждение происхождения (подписи, хеши).
- Учесть, что `PRICING_TIER_OVERRIDE=ignore-tier` отключает скидки; убедиться, что в окружении сервиса эта переменная не задана случайно.
