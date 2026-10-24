Находки записаны в `REVIEW.md`: 17 строк, из них 3 blocker, 8 major и 6 minor. Код я не менял и ничего не коммитил. Сборку и тесты не запускал — только прочитал `git diff main...HEAD` и `docs/mr/MR-41.md`.

Блокирующие:
- **SQL-инъекция:** в `FindByEmailAsync` email подставляется в запрос строкой.
- **`PaymentClient` не зарегистрирован в DI:** `OrderService` теперь требует его в конструкторе, поэтому `POST /orders` упадёт с 500.
- **Общий `/health` для liveness и readiness:** проба ходит в БД, так что при сбое Postgres Kubernetes перезапустит все поды.