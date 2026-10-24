## Симптом
report-agg (/work/prod/crashme) упал по SIGSEGV; core: /work/cores/core. PC = 0xaaaac78809c4, база загрузки 0xaaaac7880000 (смещение 0x9c4).

## Причина
`/work/src/crashme.c:21`, функция `apply_discount`: `t->rate_pct` разыменовывается без проверки, а `lookup_tier()` (строки 11–16) вернул NULL (x0 = 0), так как тарифа `"platinum"` нет в `TIERS` (строка 7: basic, silver, gold). Заказ id=4 (`"platinum"`, 90000 центов, строка 35) пришёл из `main` и дошёл до `apply_discount` через `run_batch` (строка 27). Падение — чтение по адресу NULL+8 (смещение `rate_pct`).

Соответствие сборке: build-id prod-бинаря 7037803b…4a74 совпадает с symbols/build-0419.debug (build-0412.debug имеет 7be4f756… и не подходит).

## Улики
Сборка определена по build-id:
```
$ readelf -n prod/crashme | grep Build      -> 7037803bd5a8c9ed3e41449522e2072944964a74
$ readelf -n symbols/build-0419.debug       -> 7037803bd5a8c9ed3e41449522e2072944964a74
$ readelf -n symbols/build-0412.debug       -> 7be4f756abb8cc0d57c02ee273548fefb6ca9e16
```
Инструкция падения и регистры из core:
```
$ gdb -batch -c cores/core prod/crashme -ex "x/12i \$pc-24" -ex "info registers"
   0xaaaac78809c0: bl   0xaaaac7880920        (lookup_tier)
=> 0xaaaac78809c4: ldrsw x3, [x0, #8]         (t->rate_pct)
x0  0x0
x19 0x15f90   (90000)
```
Функция и строка по смещению:
```
$ addr2line -f -i -e symbols/build-0419.debug 0x9c4 0x9c0 0xa2c
apply_discount  crashme.c:21
apply_discount  crashme.c:20
run_batch       crashme.c:27
```
Значение, приведшее к падению — массив заказов в стеке main (x/gx $sp в кадре 2) и строка тарифа заказа id=4:
```
0xfffff81ecdf0: 0x4  0x0000aaaac7880a90   0x15f90 (90000)
$ x/s 0xaaaac7880a90
"platinum"
```
Бэктрейс: apply_discount (0x9c4) <- run_batch (0xa2c) <- main (0x7c0) <- __libc_start_call_main.

## Что предлагаем
1. В `apply_discount` проверять результат `lookup_tier()` на NULL и обрабатывать неизвестный тариф явно (отклонить заказ/залогировать id и tier, либо применять 0%), а не падать.
2. Решить с бизнесом, нужен ли тариф `platinum`; если да — добавить его в `TIERS` (строка 7), если нет — валидировать вход до `run_batch`.
3. Для разбора будущих падений хранить debug-файл с build-id, совпадающим с prod-бинарём (здесь это build-0419).
