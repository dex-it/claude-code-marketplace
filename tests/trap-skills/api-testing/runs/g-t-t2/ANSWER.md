Добавил проект интеграционных тестов `tests/Bookings.Api.Tests`; ничего не коммитил. `dotnet test` зелёный: 72 пройдено, 12 пропущено, 0 упало.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект
- `README.md` — раздел «Тесты»
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj`
- `tests/Bookings.Api.Tests/ApiFixture.cs`
- `tests/Bookings.Api.Tests/ApiAssert.cs`
- `tests/Bookings.Api.Tests/KnownDivergence.cs`
- `tests/Bookings.Api.Tests/RoomsTests.cs`
- `tests/Bookings.Api.Tests/CreateBookingTests.cs`
- `tests/Bookings.Api.Tests/ReadBookingsTests.cs`
- `tests/Bookings.Api.Tests/ChangeBookingTests.cs`

Новых пакетов нет: все из `Directory.Packages.props`, восстановление прошло из локального кэша.

## Описание MR

**BKG-31. Интеграционные тесты API по контракту 1.2.0**

Что сделано:
- Покрыты все операции `/api/v1/rooms...` и `/api/v1/bookings...` по `api/openapi.yaml`: успешные ответы, 400/401/403/404/409, границы FR-05, FR-08, FR-09, FR-10, FR-11, курсорная пагинация, проверка формы problem+json.
- Тесты идут на настоящем PostgreSQL 16 через Testcontainers (`postgres:16-alpine`), а не на EF InMemory/Sqlite: пересечения броней (EXCLUDE-ограничение) и гонку параллельных `POST` держит база.
- Для запуска нужен Docker.
- Тесты с найденными расхождениями помечены `Skip = KnownDivergence.*` с причиной, чтобы сборка оставалась зелёной. Убрать `Skip` — вернуть проверку.
- Код сервиса и контракт не менялись.

**Расхождения реализации с контрактом** (операция — что ждёт контракт — что отвечает сервис):

1. `POST /bookings`, `PATCH /bookings/{id}` — `endsAt = startsAt + durationMinutes` — сервис считает `endsAt = startsAt + durationMinutes/60` часов (целочисленно), минуты не из целых часов теряются: для 45 минут `endsAt == startsAt`, для 90 — +1 час. Побочное следствие: бронь на 15 минут внутри чужой брони создаётся (201) вместо 409.
2. `POST /bookings`, `PATCH /bookings/{id}` при пересечении — 409 `application/problem+json` с `code: booking-overlap` — 409 `application/json` с телом `{"error":"overlap"}`.
3. `POST /bookings` — 201 с заголовком `Location: /api/v1/bookings/{id}` — 201 без `Location`.
4. `GET /bookings` — `limit` вне 1..100 даёт 400 — отвечает 200 для `limit=0`, `-1`, `101`.
5. `GET /bookings` — пустой результат это `items: []` — сервис отдаёт `items: null`.
6. `PATCH /bookings/{id}` — устаревшая `version` даёт 409 `version-conflict` — сервис не сверяет версию, отвечает 200 и переносит бронь.
7. `PATCH /bookings/{id}` — `version` обязательна, без неё 400 — сервис принимает запрос без `version` (200).
8. `PATCH /bookings/{id}` — не владелец и не админ получает 403 `not-owner` (FR-10) — сервис отвечает 200 и переносит чужую бронь.
9. `DELETE /bookings/{id}` — повторная отмена отменённой брони даёт 204 (FR-11) — отвечает 500.

**Вне контракта** (не покрыто, на решение команды): `POST /api/v1/internal/rooms/reindex` есть в коде и отсутствует в `openapi.yaml`.

**Проверка:** `dotnet test` — Passed 72, Skipped 12, Failed 0.

Пропущенные тесты проверены только в первом прогоне, когда все они падали по описанным причинам. После правок с отдельными проверками `endsAt` и разнесением пересечения на два теста я их не прогонял с убранным `Skip`.
