# Реестр источников

Окно: 2026-09-01 - 2026-10-10. Канал: выгрузка `review-export/` и `git log`.

## MR

| MR | Слит | Тредов разобрано | Исход |
|---|---|---|---|
| !41 | 2026-09-05 | 2 | rule |
| !42 | 2026-09-08 | 1 | no-anchor |
| !43 | 2026-09-11 | 2 | no-rule:tool-covered |
| !44 | 2026-09-14 | 2 | no-rule:out-of-scope |
| !45 | 2026-09-17 | 3 | rule |
| !46 | 2026-09-19 | 2 | no-rule:no-comments |
| !47 | не слит | 1 | rule |
| !48 | 2026-09-24 | 2 | rule |
| !49 | 2026-09-26 | 0 | no-rule:no-comments |
| !50 | 2026-09-28 | 0 | no-rule:no-comments |
| !51 | 2026-10-02 | 0 | no-rule:no-comments |

## Треды

| Тред | Автор замечания | Исход |
|---|---|---|
| !41#t1 | olga | rule RUL-0003 |
| !41#t2 | olga | no-rule:unresolved |
| !42#t1 | olga | no-anchor - правки `src/booking/slots.js` после замечания нет, исключение на месте |
| !43#t1 | olga | no-rule:tool-covered - prettier (`.prettierrc`, `npm run lint` в CI) |
| !43#t2 | olga | no-rule:tool-covered - eslint `eqeqeq` (`error`, включён в `eslint.config.js` этим MR; `npm run lint` в CI) |
| !44#t1 | sergey | no-rule:out-of-scope - противоречит ADR-0002, см. `notes.md` |
| !44#t2 | sergey | no-rule:out-of-scope - общая практика |
| !45#t1 | olga | no-rule:one-off - про один обработчик |
| !45#t2 | olga | rule RUL-0001 |
| !45#t3 | olga | rule RUL-0002 |
| !46#t1 | guest-reviewer | no-rule:no-remark - LGTM; указание агенту - `notes.md`, integrity-events |
| !46#t2 | ci-bot | no-rule:filtered |
| !47#t1 | olga | rule RUL-0004 - тред на MR со сводом, ревизия 1 |
| !48#t1 | olga | rule RUL-0005 |
| !48#t2 | olga | no-rule:tool-covered - eslint `no-unused-vars` (`warn`, `npm run lint` в CI): `stepMin` - последний параметр, дефолт `args: after-used` его ловит |

## Коммиты после ревью

| Коммит | Связан с | Исход |
|---|---|---|
| `05325cb` «CM-12: суммы возврата в копейках по замечанию ревью (!41)» | !41#t1 | rule RUL-0003 |
| `e058d67` «CM-14: тесты слотов (!42)» | !42#t1 | no-anchor - меняет только `test/`, исключение в `src/booking/slots.js` на месте |
| `8a32c42` «CM-15: отступы и строгое сравнение по ревью (!43)» | !43#t1, !43#t2 | no-rule:tool-covered |
| `e809d99` «CM-16: прямая отправка письма, .env в .gitignore (!44)» | !44#t1, !44#t2 | no-rule:out-of-scope, no-rule:out-of-scope |
| `1825bc8` «CM-18: отмена запроса к провайдеру, без ретраев, имена тестов (!45)» | !45#t1, !45#t2, !45#t3 | no-rule:one-off, rule RUL-0001, rule RUL-0002 |
| `9321a63` «CM-20: даты в UTC, шаг слотов по stepMin (!48)» | !48#t1, !48#t2 | rule RUL-0005, no-rule:tool-covered |
| `d7e6922` «CM-47: полный возврат при отмене ровно за 24 часа (!51)» | пост-мерж правка строки !41 без замечаний | rule RUL-0006 |
