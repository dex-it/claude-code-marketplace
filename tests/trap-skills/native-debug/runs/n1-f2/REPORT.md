## Симптом
report-agg (/work/prod/crashme, aarch64, -O2 -fPIE, strip) завершился по SIGSEGV. Core: /work/cores/core, "Program terminated with signal SIGSEGV", pc=0xaaaae65709c4, база PIE 0xaaaae6570000 (mapping с Offset 0x0), смещение падения 0x9c4.

## Причина
/work/src/crashme.c:21, функция `apply_discount`: `lookup_tier(o->tier)` вернул NULL, потому что тарифа "platinum" нет в `TIERS` (crashme.c:8: basic/silver/gold). Результат разыменовывается без проверки: `t->rate_pct` (crashme.c:21). Заказ id=4 содержит `{4, "platinum", 90000}` (crashme.c:36 в main, вызов через run_batch crashme.c:27).
Значение, приведшее к падению: `t == NULL` (x0=0), tier="platinum", cents=90000.
Привязка к сборке: build-id прод-бинаря 7037803b... совпадает с symbols/build-0419.debug; build-0412.debug (7be4f756...) к этому core не относится (там `discount_for`, crashme_old.c).

## Улики
1. Сборка и символы:
```
$ readelf -n prod/crashme | grep 'Build ID'     -> 7037803bd5a8c9ed3e41449522e2072944964a74
$ readelf -n symbols/build-0419.debug | grep 'Build ID' -> 7037803bd5a8c9ed3e41449522e2072944964a74
$ readelf -n symbols/build-0412.debug | grep 'Build ID' -> 7be4f756abb8cc0d57c02ee273548fefb6ca9e16
```
2. Место падения (gdb по core, без символов; 0xaaaae65709c4 - 0xaaaae6570000 = 0x9c4):
```
#0  0x0000aaaae65709c4 in ?? ()
#1  0x0000aaaae6570a2c in ?? ()
#2  0x0000aaaae65707c0 in ?? ()
$ addr2line -e symbols/build-0419.debug -f -i 0x9c4 0xa2c 0x7c0
apply_discount /tmp/src/native/crashme.c:21
run_batch      /tmp/src/native/crashme.c:27
main           /tmp/src/native/crashme.c:37
```
3. Инструкция и регистры в core:
```
   0xaaaae65709c0:	bl	0xaaaae6570920        ; lookup_tier
=> 0xaaaae65709c4:	ldrsw	x3, [x0, #8]          ; t->rate_pct
x0   0x0        0          ; результат lookup_tier = NULL
x19  0x15f90    90000      ; o->cents заказа 4
x20  0x8e94     36500      ; накопленный total
```
36500 = 9700 (basic, 10000 со скидкой 3%) + 23000 (gold, 25000 со скидкой 8%) + 3800 (silver, 4000 со скидкой 5%) - заказы 1-3 обработаны, падение на заказе 4 (cents=90000 совпадает с x19).
4. Строка тарифа в образе процесса: `x/s 0xaaaae6570a90` -> `"platinum"`; в таблице TIERS (0xaaaae658fda0) указатели ведут только на "basic"(3), "silver"(5), "gold"(8): `x/6gx 0xaaaae658fda0` -> 0x...a68 ("basic"), 3, 0x...a70 ("silver"), 5, 0x...a78 ("gold").
Оговорка: сам массив order в стеке core я не нашёл (компилятор при -O2 держит значения в регистрах/константах), поэтому "platinum" для заказа 4 подтверждён косвенно: x19=90000, x20=сумма заказов 1-3, x0=NULL и литерал "platinum" в .rodata прод-бинаря, плюс исходник.

## Что предлагаю
1. Исправить в `apply_discount` (crashme.c:20-21): проверять `t == NULL` и обрабатывать неизвестный тариф (ошибка по заказу/пропуск с логом либо скидка 0) вместо разыменования.
2. Выяснить, откуда пришёл тариф "platinum" (данные заказа 4), и либо добавить его в `TIERS` (crashme.c:8), либо отклонять такие заказы на входе.
3. Хранить debug-файл вместе с релизом по build-id (здесь это build-0419), чтобы core разбирался без догадок.
4. Код и конфигурацию сервиса я не менял.
