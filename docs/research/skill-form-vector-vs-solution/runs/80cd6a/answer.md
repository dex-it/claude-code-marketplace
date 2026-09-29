## Ревью MR «Списание баллов лояльности»

### critical
1. **app/redeem.py: `redeem()`** — `POINT_VALUE = 0.1` конвертируется через `Decimal(POINT_VALUE)`, а не `Decimal("0.1")`. `Decimal(0.1)` даёт `0.1000000000000000055511151231257827021181583404541015625` (двоичная погрешность float), что портит все денежные расчёты (`balance`, деление на `POINT_VALUE`, `balance_left`).
2. **app/redeem.py: `redeem()`** — нет проверки `amount > 0`. Отрицательный `confirm_amount` проходит проверку `amount > balance` и через `member.points -= int(amount / Decimal(POINT_VALUE))` **начисляет** баллы вместо списания — фрод-вектор.
3. **app/redeem.py + app/repo.py** — гонка чтения-изменения-записи: `get_member`/`save_member` в разных транзакциях без `SELECT ... FOR UPDATE` и без optimistic-check в `UPDATE`. Два параллельных запроса могут дважды списать один и тот же баланс.

### high
4. **app/schemas.py: `RedeemRequest.confirm_amount`** — комментарий утверждает, что `Optional[Decimal]` без default делает поле обязательным. В Pydantic v1.10 (requirements.txt) `Optional[X]` без явного default неявно получает `None` и становится необязательным — старый клиент без этого поля не получит 422, а спишет весь баланс молча.
5. **app/repo.py: `save_member` + `write_audit`** — две разные транзакции (`engine.begin()` дважды): при сбое между ними баллы спишутся без записи в аудит, что нарушает требование MR об аудите операции.
6. **app/schemas.py: `RedeemRequest.points: int`** — обязательное поле, которое нигде не используется в бизнес-логике `redeem.py` — мёртвый код либо недостающая проверка.
7. **app/redeem.py: `redeem()`** — `int(amount / Decimal(POINT_VALUE))` усекает к нулю: при некратной сумме клиенту в ответе возвращается больше, чем реально списывается баллами — систематическая утечка стоимости.

### medium
8. **app/schemas.py: `RedeemRequest`** — комментарий про отклонение лишних полей неверен: default `Config.extra` в Pydantic v1 — `'ignore'`, а не `'forbid'`; `Config` не задан, опечатки в полях клиента молча игнорируются.
9. **app/redeem.py: `redeem()`** — `valid_until` вычисляется и возвращается, но не персистится нигде (`Member` хранит только `id, points`) — заявленная в MR фича срока действия баллов по факту не реализована.
10. **app/__init__.py** — пуст, нигде нет `FastAPI()`/`include_router` — если это весь код MR, роутер физически не подключён к приложению.

### low
11. **app/redeem.py** — `HTTPException(status_code=404)` без `detail`.
12. **app/db.py** — `os.environ["DATABASE_URL"]` падает сырым `KeyError` без понятной ошибки конфигурации.

Полный текст сохранён в `/Users/anonymous/.cache/research/runs/80cd6a/work/_answer.md`.

Sources:
- [decimal — Decimal fixed-point and floating-point arithmetic (Python docs)](https://docs.python.org/3/library/decimal.html)
- [Required optional field has a default value of None after v1.7.0 (pydantic#2142)](https://github.com/pydantic/pydantic/issues/2142)
- [Configuration — Pydantic docs](https://pydantic.dev/docs/validation/latest/api/pydantic/config/)