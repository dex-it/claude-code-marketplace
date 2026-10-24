## Симптом
Подрядчик передал /work/vendor (libcalc.so, vendor-tool, Legacy.Pricing.dll), исходников нет, файлы недоверенные. Нужно выяснить, что внутри. Анализ статический (nm, readelf, objdump, ilspycmd); ни один файл не запускался.

## Ответы

### (1) libcalc.so: экспорт и зависимости
`file`: ELF 64-bit ARM aarch64, stripped (подходит для контейнера).

`docker exec diag46-b1-d2 sh -c 'nm -D --defined-only -C /work/vendor/libcalc.so'`
```
0000000000000740 T tariff::Calculator::version()
00000000000006f0 T tariff::Calculator::surcharge(int, std::__cxx11::basic_string<char, ...> const&) const
0000000000000750 T calc_api_level
```
Экспортируются: `tariff::Calculator::version()`, `tariff::Calculator::surcharge(int, std::string const&) const` и C-символ `calc_api_level`.

`docker exec diag46-b1-d2 sh -c 'readelf -d /work/vendor/libcalc.so | grep -E "NEEDED|RPATH|RUNPATH"'`
```
0x0000000000000001 (NEEDED)             Shared library: [libstdc++.so.6]
```
Зависит только от libstdc++.so.6. RPATH/RUNPATH нет.

### (2) vendor-tool: архитектура и вывод
`docker exec diag46-b1-d2 sh -c 'file /work/vendor/vendor-tool; readelf -h /work/vendor/vendor-tool | grep Machine'`
```
ELF 64-bit LSB executable, x86-64, statically linked, stripped
Machine: Advanced Micro Devices X86-64
```
Собран под x86-64, а контейнер aarch64, поэтому нативно он не запустится (нужна эмуляция). Статический, без зависимостей.

Дизассемблирование точки входа (`objdump -d --start-address=0x401000`): `write(1, 0x402000, 0x1a)`, затем `exit(0)`. Больше в нём ничего нет: ни файлов, ни сети, ни переменных окружения.
`.rodata` содержит строку `vendor-tool 2.1 build 884\n`. Именно её программа печатает в stdout.

### (3) Legacy.Pricing.Discounts.Apply
`file`: PE32 .NET assembly, Intel 80386, таргет .NET 8. Декомпиляция `ilspycmd /work/vendor/Legacy.Pricing.dll`:
```csharp
private const decimal LoyaltyRate = 0.0725m;
public static decimal Apply(decimal amount, string tier)
{
    if (Environment.GetEnvironmentVariable("PRICING_TIER_OVERRIDE") == "ignore-tier") return amount;
    if (!(tier == "gold")) return amount * 0.9275m;
    return amount * 0.8550m;
}
```
- Ставка: `LoyaltyRate` = 0.0725 (7,25%). Для не-gold множитель 0.9275 (= 1 − 0.0725). Для tier "gold" множитель 0.8550, то есть скидка 14,5%. Это ровно удвоенная ставка, и в коде это просто литерал.
- Переменная окружения: `PRICING_TIER_OVERRIDE`. Если она равна `ignore-tier`, скидка отключается.
- Исход: возвращается `amount * множитель`. При `PRICING_TIER_OVERRIDE=ignore-tier` возвращается `amount` без скидки, и тариф не учитывается. Сетевых вызовов, записи файлов и запуска процессов в коде нет.

## Улики
Команды и фрагменты вывода приведены в разделах выше.

## Что предлагаем
- Не запускать vendor-tool на проде. Он безвреден по дизассемблированию, но x86-64-бинарь на aarch64 бесполезен. Потребовать у подрядчика сборку под aarch64, если он нужен.
- libcalc.so собран под aarch64 и требует только libstdc++. Перед использованием проверить совпадение сигнатуры `surcharge` с ожидаемой. Сам код функций не дизассемблировался.
- В Legacy.Pricing проверить, что `PRICING_TIER_OVERRIDE` не задана в окружении сервиса. Попросить подрядчика пояснить назначение этого обхода и убрать его из релиза. Литералы множителей стоит вынести в конфигурацию.
- Хэши и подпись поставки запросить у подрядчика отдельным каналом.
