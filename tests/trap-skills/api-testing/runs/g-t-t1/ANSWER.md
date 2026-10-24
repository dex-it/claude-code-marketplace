Интеграционные тесты API по BKG-31 написаны. `dotnet test Bookings.sln`: 60 пройдено, 0 упало, 10 пропущено — пропущены тесты на найденные расхождения. Ничего не закоммичено.

## Изменённые файлы
- `Bookings.sln` — добавлен тестовый проект (папка `tests`).
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — проект; пакеты только из `Directory.Packages.props`.
- `tests/Bookings.Api.Tests/BookingsApiFactory.cs` — `WebApplicationFactory` и контейнер PostgreSQL 16 (Testcontainers), ключи участников и администратора.
- `tests/Bookings.Api.Tests/ApiTestBase.cs` — общие хелперы, проверки problem+json, константы причин пропуска.
- `tests/Bookings.Api.Tests/RoomsTests.cs` — операции комнат, включая устаревшую `/rooms/{roomId}/bookings`.
- `tests/Bookings.Api.Tests/BookingsTests.cs` — операции броней.

## Описание MR
**BKG-31: интеграционные тесты API по контракту 1.2.0**

Тесты идут против настоящего PostgreSQL в контейнере (образ `postgres:16-alpine`, есть локально). Запрет пересечений броней и версия брони держатся базой (exclusion constraint, `xmin`), а EF InMemory и Sqlite это не воспроизводят.

Покрыто: все операции комнат и броней контракта, успешные ответы и ошибки 400/401/403/404/409. Отдельно проверены:
- границы длительности и горизонт 90 дней;
- смежные брони и отмена, освобождающая слот;
- курсорная пагинация и границы периода `from`/`to`;
- права владельца и администратора;
- конкурентное создание на один слот: из 5 запросов проходит один.

Тесты на найденные расхождения помечены `Skip` с причиной, чтобы `dotnet test` оставался зелёным. Когда расхождение исправят, `Skip` надо снять.

### Расхождения реализации с контрактом
1. `POST /api/v1/bookings` — контракт: при пересечении 409 `application/problem+json` с `code: booking-overlap`; сервис: 409 с телом `{"error":"overlap"}` и `application/json`.
2. `PATCH /api/v1/bookings/{bookingId}` — контракт: при пересечении 409 `booking-overlap` в problem+json; сервис: 409 с телом `{"error":"overlap"}`.
3. `PATCH /api/v1/bookings/{bookingId}` — контракт: устаревшая `version` даёт 409 `version-conflict`; сервис: версия из запроса не проверяется, ответ 200 и перенос выполнен.
4. `PATCH /api/v1/bookings/{bookingId}` — контракт: чужая бронь (не владелец, не админ) даёт 403 `not-owner`; сервис: 200, перенос выполнен.
5. `DELETE /api/v1/bookings/{bookingId}` — контракт: повторная отмена даёт 204 (FR-11); сервис: 500.
6. `POST /api/v1/bookings` и `PATCH /api/v1/bookings/{bookingId}` — контракт: `endsAt = startsAt + durationMinutes`; сервис: прибавляет только целые часы, для 90 минут `endsAt` = start + 1 ч, для 45 минут `endsAt` = `startsAt`.
7. `POST /api/v1/bookings` — контракт: 201 с заголовком `Location: /api/v1/bookings/{bookingId}`; сервис: заголовка нет.
8. `GET /api/v1/bookings` — контракт: пустой результат — `items: []`; сервис: `items: null`.
9. `GET /api/v1/bookings` — контракт: `limit` в 1..100, иначе 400; сервис: `limit=0` и `limit=101` дают 200.

### Вне контракта (не тестировалось)
- `POST /api/v1/internal/rooms/reindex` есть в коде, в `openapi.yaml` отсутствует.
- `createdAt` в ответах броней в контракте не описан.

Тесты запускаются только при доступном Docker: контейнер Postgres поднимается самими тестами.
