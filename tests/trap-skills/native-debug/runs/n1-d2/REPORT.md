# report-agg: SIGSEGV

## Симптом
Процесс /work/prod/crashme (report-agg) завершился по SIGSEGV; остался /work/cores/core (aarch64).

## Причина
`apply_discount`, `/work/src/crashme.c:21` (`t->rate_pct`): `lookup_tier()` (строки 11-16) вернула NULL для тарифа `"platinum"` (заказ id=4, 90000 центов, итерация i=3), которого нет в таблице `TIERS` (строка 7: basic/silver/gold). Результат не проверяется на NULL (строки 20-21), поэтому чтение `[NULL+8]` даёт segfault.
Значение, приведшее к падению: `o->tier == "platinum"`.

## Улики
Сборка: build-id prod-бинаря `7037803b…4a74` совпадает с `/work/symbols/build-0419.debug` (build-0412 имеет `7be4f756…` и не подходит).

`gdb -batch -ex "add-symbol-file symbols/build-0419.debug -o 0xaaaabe4f0000" -ex bt ... prod/crashme cores/core`
```
#0  apply_discount (o=0xffffd33c78b0) at /tmp/src/native/crashme.c:21
#1  0x0000aaaabe4f0a2c in run_batch (orders=..., n=5) at crashme.c:27
#2  0x0000aaaabe4f07c0 in main () at crashme.c:37
pc  0xaaaabe4f09c4 <apply_discount+20>
x0  0x0                       (результат lookup_tier = NULL)
=> 0xaaaabe4f09c4 <apply_discount+20>: ldrsw x3, [x0, #8]
x19 0x15f90  (90000 = o->cents)
```
Фрейм 1: `i = 3, total = 36500` (сумма трёх обработанных заказов: 9700+23000+3800).
Фрейм 2 (`batch` из core):
```
{id = 4, tier = 0xaaaabe4f0a90 "platinum", cents = 90000}
```
Заказ с индексом 3 = id 4 = "platinum"; cents совпадает с x19.

## Что предлагаю
- В `apply_discount` проверять `t == NULL`: отклонять/логировать заказ с неизвестным тарифом (или применять скидку 0) вместо разыменования.
- Решить на уровне бизнеса, нужен ли тариф "platinum": если да, добавить его в `TIERS`; если данные ошибочны, исправить источник.
- Добавить тест с неизвестным тарифом; хранить debug-файлы по build-id, чтобы сопоставление с core было однозначным.
