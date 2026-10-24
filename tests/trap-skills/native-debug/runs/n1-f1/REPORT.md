# REPORT: report-agg, SIGSEGV

## Симптом
Сервис report-agg (`/work/prod/crashme`, aarch64, PIE, stripped) завершился по SIGSEGV (si_signo=11) при обработке пакета заказов. Адрес обращения 0x8. Core: `/work/cores/core`.

## Причина
`src/crashme.c:21` в `apply_discount`: `t->rate_pct` разыменовывается без проверки `t`. `lookup_tier()` (строки 11-16) возвращает NULL для неизвестного тарифа. В пакете заказ id=4 с `tier="platinum"` (cents=90000), а в `TIERS` (строка 7) только basic/silver/gold. `t == NULL`, чтение `[NULL + 8]` (поле `rate_pct`) даёт fault на адресе 0x8.
Цепочка вызовов: `main` (стр. 37) -> `run_batch` (стр. 27) -> `apply_discount` (стр. 21).
Значение, приведшее к падению: `o->tier = "platinum"`, то есть NULL из `lookup_tier`.

## Улики
Символы подбирались по build-id. Prod-бинарь и `symbols/build-0419.debug` имеют одинаковый Build ID `7037803bd5a8c9ed3e41449522e2072944964a74`. `build-0412.debug` (`7be4f756...`) не подходит: у него функции `discount_for`/`sum_orders` из `crashme_old.c`.

1. Сигнал, адрес и инструкция падения (из core):
   `docker exec diag46-n1-f1 sh -c 'cd /work; gdb -q -batch -ex "x/2i 0xaaaae53109c0" -ex "p/x \$_siginfo._sifields._sigfault.si_addr" prod/crashme cores/core'`
   ```
   Program terminated with signal SIGSEGV, Segmentation fault.
      0xaaaae53109c0:	bl	0xaaaae5310920
   => 0xaaaae53109c4:	ldrsw	x3, [x0, #8]
   $1 = 0x8
   ```
   В регистрах core `x0 = 0x0`: результат `lookup_tier` равен NULL, чтение `[x0+8]` падает.

2. Адреса в строки (база PIE 0xaaaae5310000 из LOAD-сегмента core; смещения 0x9c4, 0xa2c, 0x7c0):
   `docker exec diag46-n1-f1 addr2line -e /work/symbols/build-0419.debug -f -C 0x9c4 0xa2c 0x7c0`
   ```
   apply_discount  /tmp/src/native/crashme.c:21
   run_batch       /tmp/src/native/crashme.c:27
   main            /tmp/src/native/crashme.c:37
   ```
   Стек из core: `#0 0xaaaae53109c4`, `#1 0xaaaae5310a2c`, `#2 0xaaaae53107c0`, затем `__libc_start_call_main`.

3. Значение из памяти core: массив `batch[]` на стеке `main`, заказ №4:
   `gdb -batch -ex "x/3gx 0xffffc2f713a0" -ex "x/s 0xaaaae5310a90" prod/crashme cores/core`
   ```
   0xffffc2f713a0: 0x0000000000000004  0x0000aaaae5310a90
   0xffffc2f713b0: 0x0000000000015f90
   0xaaaae5310a90: "platinum"
   ```
   id=4, tier="platinum", cents=0x15f90=90000. Заказы 1-3 (basic, gold, silver) имеют валидные тарифы, падение на четвёртом.

## Что предлагаю
1. Исправление в коде (нужно решение владельцев; сервис я не менял): в `apply_discount` проверять `t == NULL`. Дальше выбрать политику: скидка 0%, пропуск заказа с записью в лог (id, tier) или явная ошибка по заказу. Падать на всём пакете из-за одного заказа нельзя.
2. Решить с бизнесом, нужен ли тариф "platinum". Если да, добавить его в `TIERS` (стр. 7) с согласованной ставкой. Сейчас он отсутствует в таблице.
3. Проверка на входе пакета: валидировать `tier` по `TIERS` до расчёта и отбраковывать неизвестные значения, показывая их в отчёте.
4. Для эксплуатации: хранить `symbols/build-0419.debug` вместе с релизом и подбирать debug-файл по build-id (по именам build-0412/0419 легко ошибиться). Включить в пакет регрессионный тест с неизвестным тарифом.
5. Заказ id=4 из текущего пакета не обработан. После исправления его нужно пересчитать отдельно и перезапустить пакет.
