# report-agg: SIGSEGV

## Симптом
report-agg (/work/prod/crashme) завершился по SIGSEGV. Core: `Program terminated with signal SIGSEGV`, pc=0x0000aaaaba1f09c4 (база PIE 0xaaaaba1f0000, смещение 0x9c4), инструкция `ldrsw x3, [x0, #8]` при x0 = 0.

## Причина
`/work/src/crashme.c:21` в `apply_discount`: `t->rate_pct` читается без проверки `t`. `lookup_tier` (строки 11-16) возвращает NULL для тарифа, которого нет в `TIERS` (строка 7: basic, silver, gold). Заказ №4 (`crashme.c:35`) имеет тариф `"platinum"`, и `lookup_tier` вернул NULL. Чтение `rate_pct` по смещению 8 от NULL дало обращение к адресу 8. Цепочка вызовов: `main:37` -> `run_batch:27` -> `apply_discount:21`.

## Улики
Бинарь prod совпадает по build-id с `/work/symbols/build-0419.debug` (7037803b...). Build-0412 имеет другой id (7be4f756...) и не подходит.

    readelf -n /work/prod/crashme | grep Build   -> 7037803bd5a8c9ed3e41449522e2072944964a74
    readelf -n /work/symbols/build-0419.debug    -> 7037803bd5a8c9ed3e41449522e2072944964a74

Место падения в core (`gdb -batch -ex bt -ex "x/6i $pc-8" -ex "info registers" crashme core`):

    #0  0x0000aaaaba1f09c4 in ?? ()
    #1  0x0000aaaaba1f0a2c in ?? ()
    #2  0x0000aaaaba1f07c0 in ?? ()
    bl 0xaaaaba1f0920            (вызов lookup_tier)
    => 0xaaaaba1f09c4: ldrsw x3, [x0, #8]
    x0 = 0x0   x19 = 0x15f90 (90000)

Строки по смещениям из нужной сборки (`addr2line -f -i -e build-0419.debug 0x9c4 0xa2c 0x7c0`):

    apply_discount crashme.c:21
    run_batch      crashme.c:27
    main           crashme.c:37

Значение, приведшее к падению. Структура order в стеке main (`x/4gx 0xfffff92a0dd0`, `x/s 0xaaaaba1f0a90`):

    0xfffff92a0dd0: 0x4 (id)  0xaaaaba1f0a90 -> "platinum"
    0xfffff92a0de0: 0x15f90 (cents = 90000)

То есть падение произошло на заказе {id=4, tier="platinum", cents=90000}.

## Что предлагаю
1. В `apply_discount` (crashme.c:20-21) проверять `t == NULL`. Заказ с неизвестным тарифом нужно пропустить с записью в лог и ошибкой по заказу, либо применить нулевую скидку, либо отклонить весь пакет. Какой вариант выбрать, решает владелец бизнес-правила.
2. Решить, нужен ли тариф "platinum": если да, добавить его в `TIERS` (crashme.c:7) с согласованной ставкой.
3. Проверять тарифы при приёме пакета, чтобы один заказ не валил весь агрегатор.
4. Хранить debug-файл вместе с каждым prod-релизом и сопоставлять его по build-id. В `/work/symbols` лежат две сборки, подходит только 0419.
