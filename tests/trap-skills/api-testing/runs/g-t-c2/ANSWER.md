`dotnet test Bookings.sln` зелёный: 86 пройдено, 12 пропущено, 0 упало. Тесты идут на настоящем PostgreSQL через Testcontainers (образ `postgres:16-alpine` есть локально), потому что запрет пересечений и версия брони реализованы в БД. Исходный код сервиса не менялся, коммита нет.

## Изменённые файлы

- `Bookings.sln`: добавлен проект тестов (папка `tests`).
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj`: пакеты только из `Directory.Packages.props`.
- `tests/Bookings.Api.Tests/ApiFixture.cs`: контейнер PostgreSQL, фабрика приложения с тестовыми ключами, создание отдельной комнаты на каждый тест.
- `tests/Bookings.Api.Tests/ApiTestBase.cs`: общие помощники.
- `tests/Bookings.Api.Tests/ContractAssert.cs`: проверки форм `Room`, `Booking`, `Problem` и `ValidationProblem`.
- `tests/Bookings.Api.Tests/Discrepancy.cs`: причины пропуска тестов.
- `tests/Bookings.Api.Tests/RoomsTests.cs`: комнаты и устаревшие брони комнаты.
- `tests/Bookings.Api.Tests/BookingsTests.cs`: создание, чтение, лента с курсором, перенос, отмена.
- `tests/Bookings.Api.Tests/AuthTests.cs`: 401 на всех 8 операциях (без ключа и с неизвестным ключом), владелец брони.

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Добавлен проект `tests/Bookings.Api.Tests` (xUnit + `WebApplicationFactory` + Testcontainers PostgreSQL). Он покрывает все операции `/api/v1/rooms...` и `/api/v1/bookings...`: успешные ответы, ответы ошибок 400/401/403/404/409 с проверкой `code`, пересечения, версионирование, повторную отмену (FR-11) и курсорную пагинацию.

Для запуска нужен Docker. Тесты с найденными расхождениями помечены `Skip` с описанием в `Discrepancy.cs`. Они уже содержат ожидание контракта, после исправления сервиса достаточно убрать `Skip`.

**Расхождения реализации с контрактом** (операция: что ждёт контракт, что отвечает сервис):

- `POST /bookings`: 201 с заголовком `Location`, сервис заголовок не отдаёт.
- `POST /bookings`, `PATCH /bookings/{id}`: `endsAt` = `startsAt` + `durationMinutes`, сервис считает `AddHours(durationMinutes / 60)`, поэтому для 15/45/90 минут `endsAt` неверен.
- `POST /bookings`, `PATCH /bookings/{id}`: при пересечении 409 `problem+json` с `code: booking-overlap`, сервис отвечает 409 `application/json` с телом `{"error":"overlap"}`.
- `POST /bookings`: `roomId` длиннее 64 даёт 400, сервис отвечает 404 `room-not-found`.
- `GET /bookings`: пустой результат — `items: []`, сервис отдаёт `items: null`.
- `GET /bookings`: `limit` вне 1..100 даёт 400, сервис отвечает 200.
- `GET/PATCH/DELETE /bookings/{id}` с не-UUID: 404 с `code: booking-not-found`, сервис отвечает 404 `problem+json` без `code`. Проверял только `GET`; для `PATCH`/`DELETE` маршрут тот же, но не проверен.
- `PATCH /bookings/{id}`: чужая бронь даёт 403 `not-owner`, сервис переносит её и отвечает 200 (нарушение FR-10).
- `PATCH /bookings/{id}`: устаревшая `version` даёт 409 `version-conflict`, сервис игнорирует `version` и отвечает 200 (нарушение FR-06).
- `PATCH /bookings/{id}`: тело без `version` даёт 400, сервис отвечает 200.
- `DELETE /bookings/{id}`: повторная отмена даёт 204 (FR-11), сервис отвечает 500 (`InvalidOperationException` в `Booking.Cancel`).

**Замечание вне контракта:** `BookingDto` отдаёт лишнее поле `createdAt`, которого нет в схеме `Booking`. Тесты на это не падают. В коде также есть `POST /api/v1/internal/rooms/reindex`, он в контракте не описан и не тестировался.
