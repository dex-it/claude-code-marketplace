# REPORT: падение report-agg (SIGSEGV)

## Симптом
report-agg (`/work/prod/crashme`, aarch64, -O2 -fPIE, strip) завершился по SIGSEGV. gdb по core: `Program terminated with signal SIGSEGV`, pc=0xaaaabbd509c4, стек `?? <- ?? <- ?? <- __libc_start_call_main`. Без символов функции не видны.

## Причина
`/work/src/crashme.c:21`, функция `apply_discount`: `t->rate_pct` разыменовывается без проверки `t` на NULL (`t` = результат `lookup_tier()`, crashme.c:12-16, который возвращает NULL для неизвестного тарифа).

В заказе №4 (`{4, "platinum", 90000}`, crashme.c:34) тариф "platinum" отсутствует в таблице `TIERS` (crashme.c:8: basic/silver/gold). `lookup_tier` вернул NULL, и `ldrsw x3, [x0, #8]` (чтение `rate_pct` по смещению 8 от NULL) упало. Значение, приведшее к падению: `o->tier = "platinum"`, из-за которого `t == NULL` (x0 = 0).

Падение не связано с версией сборки. Prod-бинарь соответствует `build-0419.debug` по build-id. `build-0412.debug` (build-id 7be4f756..., `crashme_old.c`) не подходит.

## Улики
1. Build-id prod-бинаря совпадает с `build-0419.debug` (не с 0412):
   ```
   $ readelf -n /work/prod/crashme | grep "Build ID"
       Build ID: 7037803bd5a8c9ed3e41449522e2072944964a74
   $ readelf -n /work/symbols/build-0419.debug | grep "Build ID"
       Build ID: 7037803bd5a8c9ed3e41449522e2072944964a74
   $ readelf -n /work/symbols/build-0412.debug | grep "Build ID"
       Build ID: 7be4f756abb8cc0d57c02ee273548fefb6ca9e16
   ```
2. Из core: адрес падения, регистры, инструкция:
   ```
   $ gdb -batch -ex bt -ex "info registers" -ex "x/6i \$pc-8" /work/prod/crashme /work/cores/core
   Program terminated with signal SIGSEGV, Segmentation fault.
   #0  0x0000aaaabbd509c4 in ?? ()
   #1  0x0000aaaabbd50a2c in ?? ()
   #2  0x0000aaaabbd507c0 in ?? ()
   x0   0x0   0
   x19  0x15f90   90000
      0xaaaabbd509c0:  bl   0xaaaabbd50920
   => 0xaaaabbd509c4:  ldrsw x3, [x0, #8]
   ```
   Перед `ldrsw` стоит `bl 0x...920` (вызов `lookup_tier`), x0 = 0, то есть адрес чтения = 0+8. x19 = 90000 (`o->cents`).
3. База загрузки из core и перевод адресов в строки (база 0xaaaabbd50000, смещение 0x9c4):
   ```
   $ gdb -batch -ex "info proc mappings" ... | grep crashme
   0xaaaabbd50000  0xaaaabbd51000  0x1000  0x0  /work/prod/crashme
   $ addr2line -e /work/symbols/build-0419.debug -f -i -C 0x9c4 0xa2c 0x920
   apply_discount  /tmp/src/native/crashme.c:21
   run_batch       /tmp/src/native/crashme.c:27
   lookup_tier     /tmp/src/native/crashme.c:12
   ```
   0x9c4 - место падения, 0xa2c - адрес возврата в `run_batch`, 0x920 - вызываемая `lookup_tier`.
4. Данные в core: структура заказа в стеке `main`, на которую указывает `o`:
   ```
   $ gdb -batch -ex "x/6gx 0xffffca7d6dc8" -ex "x/s 0xaaaabbd50a90" ...
   0xffffca7d6dc8: 0x0000000000000004  0xaaaabbd50a90   <- id=4, tier=ptr
   0xffffca7d6dd8: 0x0000000000015f90  0xaaaabbd50a78   <- cents=90000
   0xaaaabbd50a90: "platinum"
   ```
   id=4, tier="platinum", cents=90000. Это заказ №4 из `batch[]`. Он четвёртый в списке, поэтому первые три заказа обработаны, и в стеке виден их промежуточный итог (x20 = 36500 = 9700 + 23000 + 3800 после скидок).
5. Таблица тарифов в `.rodata` prod-бинаря содержит только три имени:
   ```
   $ strings -t x /work/prod/crashme | grep -E "platinum|silver|basic|gold"
   a68 basic
   a70 silver
   a78 gold
   a90 platinum
   ```
   "platinum" есть только как данные заказа (`a90`), в `TIERS` его нет.

## Что предлагаю
1. Исправление в коде (не вносилось, по условию): в `apply_discount` проверять `t == NULL` и обрабатывать неизвестный тариф явно: отклонить заказ с логом `order id / tier`, либо применить скидку 0%, либо добавить тариф "platinum" в `TIERS`. Какой вариант выбрать, решает владелец бизнес-логики.
2. Проверить источник данных. Выяснить, откуда в пакет пришёл тариф "platinum" и должен ли он поддерживаться (новый тариф, ошибка выгрузки).
3. До выпуска исправления: убрать или исправить заказ №4 во входном пакете, иначе падение будет повторяться на каждом запуске.
4. Хранить `.debug` и core вместе с build-id (сейчас бинарь stripped, и `bt` показывает только `??`). Для этого инцидента нужная сборка - `build-0419.debug`.
