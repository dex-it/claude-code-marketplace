# Реестр источников

Окно: 2026-09-01 - 2026-10-12. Канал: выгрузка `review-export/` и `git log`.

## MR

| MR | Слит | Тредов разобрано | Исход |
|---|---|---|---|
| !41 | 2026-09-05 | 2 | rule |
| !42 | 2026-09-08 | 1 | rule |
| !43 | 2026-09-11 | 2 | rule |
| !44 | 2026-09-14 | 2 | no-rule:out-of-scope |
| !45 | 2026-09-17 | 3 | rule |
| !46 | 2026-09-19 | 2 | no-rule:filtered |
| !47 | не слит | 1 | rule |
| !48 | 2026-09-24 | 1 | rule |
| !49 | 2026-09-26 | 0 | no-rule:no-comments |
| !50 | 2026-09-28 | 0 | no-rule:no-comments |
| !51 | 2026-10-02 | 0 | no-rule:no-comments |
| !52 | 2026-10-07 | 1 | rule |
| !53 | открыт | 2 | rule |

## Треды

| Тред | Автор замечания | Исход |
|---|---|---|
| !41#t1 | olga | rule RUL-0005 |
| !41#t2 | olga | no-rule:unresolved |
| !42#t1 | olga | rule RUL-0009 |
| !43#t1 | olga | rule RUL-0006 |
| !43#t2 | olga | rule RUL-0007 |
| !44#t1 | sergey | no-rule:out-of-scope |
| !44#t2 | sergey | no-rule:out-of-scope |
| !45#t1 | olga | rule RUL-0013 |
| !45#t2 | olga | rule RUL-0002 |
| !45#t3 | olga | rule RUL-0014 |
| !46#t1 | guest-reviewer | no-rule:one-off |
| !46#t2 | ci-bot | no-rule:filtered |
| !47#t1 | olga | rule RUL-0011 |
| !48#t2 | olga | rule RUL-0019 |
| !52#t1 | sergey | rule RUL-0018 |
| !53#t1 | sergey | rule RUL-0017 |
| !53#t2 | olga | no-rule:rejected-by-owner RUL-0003 |

## Коммиты после ревью

| Коммит | Связан с | Исход |
|---|---|---|
| «CM-12: суммы возврата в копейках по замечанию ревью (!41)» | !41#t1 | rule RUL-0005, RUL-0012 |
| «CM-14: свободные слоты репетитора (!42)» | - | rule RUL-0010 |
| «CM-15: отступы и строгое сравнение по ревью (!43)» | !43#t1, !43#t2 | rule RUL-0006, RUL-0007 |
| «CM-18: отмена запроса к провайдеру, без ретраев, имена тестов (!45)» | !45#t1, !45#t2, !45#t3 | rule RUL-0008, RUL-0013, RUL-0014 |
| «CM-20: перенос урока (!48)» | - | rule RUL-0015 |
| «CM-23: ключ SMTP из окружения (!52)» | !52#t1 | rule RUL-0018 |
