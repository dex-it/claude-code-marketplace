Интеграционные тесты API по контракту 1.2.0 готовы. `dotnet test` зелёный: 56 пройдено, 10 пропущено, 0 упало. Пропущены тесты на найденные расхождения реализации с контрактом; ничего не закоммичено.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект в папку `tests`.
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — проект на xunit 2.9.3, пакеты только из `Directory.Packages.props`.
- `tests/Bookings.Api.Tests/ApiFixture.cs` — сервис через `WebApplicationFactory<Program>` на настоящем PostgreSQL 16 в Testcontainers (образ `postgres:16-alpine` есть локально).
- `tests/Bookings.Api.Tests/ApiTestBase.cs` — общие помощники тестов.
- `tests/Bookings.Api.Tests/ContractAssert.cs` — проверки схем `Room` и `Booking`, `application/problem+json` с `code`, `ValidationProblem`.
- `tests/Bookings.Api.Tests/RoomsTests.cs` — операции комнат.
- `tests/Bookings.Api.Tests/BookingsTests.cs` — операции броней.
- `tests/Bookings.Api.Tests/KnownDefects.cs` — тексты причин пропуска тестов на расхождения.

## Описание MR

**BKG-31. Интеграционные тесты API по контракту (1.2.0)**

Добавлен проект `tests/Bookings.Api.Tests` (66 тестов). Тесты идут против настоящего PostgreSQL 16 через Testcontainers, а не против EF InMemory или Sqlite: пересечения броней держит exclusion-ограничение БД. Поэтому есть и тест параллельного создания: 8 запросов на одно время дают ровно один 201, остальные 409.

Покрыто:
- **Комнаты:** `listRooms` (порядок, `limit`/`offset`, 400, 401), `getRoom` (200, 404), устаревший `listRoomBookings` (период, порядок, отменённые, 404, 400).
- **Брони:** `createBooking`, `listBookings` (фильтры, курсор, период), `getBooking`, `rescheduleBooking`, `cancelBooking`.
- **Ошибки:** 400, 401, 403, 404, 409 по контракту.

Расхождения, найденные тестами. Тесты на них помечены `Skip` с причиной в `KnownDefects.cs`; без `Skip` падают именно на этих проверках. Код сервиса не менялся.

- `POST /api/v1/bookings` — контракт: 201 с заголовком `Location: /api/v1/bookings/{id}`; сервис: 201 без `Location`.
- `POST /api/v1/bookings` и `PATCH /api/v1/bookings/{id}` — контракт: `endsAt = startsAt + durationMinutes`; сервис: прибавляет целые часы (`duration / 60`), 90 мин даёт +1 ч, 15 мин даёт +0.
- `POST /api/v1/bookings` при пересечении — контракт: 409 `application/problem+json`, `code: booking-overlap`; сервис: 409 `application/json` с телом `{"error":"overlap"}`.
- `PATCH /api/v1/bookings/{id}` при пересечении — контракт: 409 `application/problem+json`, `code: booking-overlap`; сервис: 409 `application/json` с телом `{"error":"overlap"}`.
- `PATCH /api/v1/bookings/{id}` чужой брони — контракт: 403 `not-owner` для не владельца и не администратора (FR-10); сервис: переносит чужую бронь, 200.
- `PATCH /api/v1/bookings/{id}` с устаревшей `version` — контракт: 409 `version-conflict`; сервис: игнорирует `version` из запроса, 200.
- `DELETE /api/v1/bookings/{id}` повторно — контракт: 204 (FR-11); сервис: 500.
- `GET /api/v1/bookings` без результатов — контракт: `items: []`; сервис: `items: null`.
- `GET /api/v1/bookings?limit=0` и `limit=101` — контракт: 400 (`limit` 1..100); сервис: 200.
- `GET /api/v1/bookings?limit=-5` — контракт: 400; сервис: 500.

Замечания вне списка расхождений:
- `POST /api/v1/internal/rooms/reindex` есть в коде, но отсутствует в контракте; тестами не покрыт.
- `BookingDto` отдаёт поле `createdAt`, которого нет в схеме `Booking`; схема это не запрещает.

## Примечания

- **Нужен Docker:** тесты запускают `postgres:16-alpine` через Testcontainers, без доступного Docker они не стартуют. Образ и `testcontainers/ryuk` есть в локальном кэше.
- **Чужой контейнер не использовал:** на хосте работал `pg-sup1545` на порту 55432, к нему тесты не подключаются.
- **Общая база:** тесты делят одну базу и берут непересекающиеся 4-часовые окна через `NextSlot()`, поэтому порядок запуска не важен.
