# report-agg: SIGSEGV

## Симптом
Процесс /work/prod/crashme (report-agg) завершился по SIGSEGV. Core: /work/cores/core.

## Причина
`apply_discount`, crashme.c:21 (`o->cents * t->rate_pct`): `lookup_tier()` (crashme.c:11-16) вернула NULL для тарифа `"platinum"` (заказ id=4, cents=90000), которого нет в `TIERS` (crashme.c:7: basic/silver/gold). Результат не проверяется на NULL (crashme.c:20-21), и чтение `t->rate_pct` по адресу NULL+8 приводит к падению.
Цепочка: main (:37) → run_batch (:27) → apply_discount (:21).

## Улики
Соответствие символов: build-id prod-бинаря = build-id `build-0419.debug` (7037803b…4a74); `build-0412.debug` (7be4f756…) не подходит.
```
$ readelf -n /work/prod/crashme | grep "Build ID"      -> 7037803bd5a8c9ed3e41449522e2072944964a74
$ readelf -n /work/symbols/build-0419.debug | grep ... -> 7037803bd5a8c9ed3e41449522e2072944964a74
```
Падение в core (gdb, символы 0419 со смещением загрузки 0xaaaaabaf0000):
```
$ gdb -batch -ex "symbol-file /work/symbols/build-0419.debug -o 0xaaaaabaf0000" -ex bt /work/prod/crashme /work/cores/core
Program terminated with signal SIGSEGV, Segmentation fault.
#0  apply_discount (o=0xfffff920b5e0) at /tmp/src/native/crashme.c:21
#1  run_batch (orders=..., n=5) at /tmp/src/native/crashme.c:27
#2  main () at /tmp/src/native/crashme.c:37
=> 0xaaaaabaf09c4:  ldrsw x3, [x0, #8]        ; x0 = 0
```
Значения:
```
(gdb) p *o        -> {id = 4, tier = 0xaaaaabaf0a90 "platinum", cents = 90000}
(gdb) p $x0       -> 0   (результат lookup_tier, t == NULL; доступ к адресу 0x8 = &t->rate_pct)
```

## Что предлагаю
- В `apply_discount` проверять `t == NULL` и обрабатывать явно: отклонить/залогировать заказ с неизвестным тарифом либо применить скидку 0%. Выбор политики за владельцем бизнес-логики.
- Выяснить, откуда в данных взялся тариф `platinum`: добавить его в `TIERS` или исправить источник данных.
- Валидировать тарифы на входе пакета, чтобы один заказ не ронял весь батч.
- Хранить debug-файлы с привязкой по build-id: в каталоге две сборки, и корректна только 0419.
