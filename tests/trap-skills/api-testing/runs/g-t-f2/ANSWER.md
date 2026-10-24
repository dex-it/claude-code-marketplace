Добавил тестовый проект `tests/Bookings.Api.Tests`; `dotnet test` зелёный: 62 пройдено, 9 пропущено, 0 упало. Девять пропущенных — тесты на найденные расхождения. Ничего не закоммичено, код сервиса не менялся.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект в папку решения `tests`
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — новый; пакеты из `Directory.Packages.props` (Mvc.Testing, xunit, Test.Sdk, Testcontainers.PostgreSql)
- `tests/Bookings.Api.Tests/BookingsApiFactory.cs` — сервис поверх PostgreSQL в Testcontainers (образ `postgres:16-alpine`, он есть локально)
- `tests/Bookings.Api.Tests/ApiTestBase.cs` — помощники, изоляция тестов по «окнам» (комната и время), проверки problem+json
- `tests/Bookings.Api.Tests/RoomsTests.cs` — комнаты, включая устаревший `/rooms/{id}/bookings`
- `tests/Bookings.Api.Tests/BookingsTests.cs` — создание, чтение, лента с курсором, перенос, отмена

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Тесты проверяют операции `/api/v1/rooms...` и `/api/v1/bookings...`: успешные ответы и ошибки 400, 401, 403, 404, 409, которые описывает контракт. Тесты идут через `WebApplicationFactory` против настоящего PostgreSQL в Testcontainers, потому что ограничение пересечений броней живёт в БД (`btree_gist`). Для запуска нужен Docker с образом `postgres:16-alpine`. Сервис не менялся.

**Расхождения реализации с контрактом** (по одному на строку: операция, что ждёт контракт, что отвечает сервис). Соответствующие тесты помечены `Skip` с причиной; когда сервис исправят, `Skip` снимают.

- `POST /bookings` — 201 с заголовком `Location: /api/v1/bookings/{id}` (обязателен); сервис отвечает 201 без `Location`.
- `POST /bookings`, `PATCH /bookings/{id}` — `endsAt` = `startsAt + durationMinutes`; сервис считает `startsAt + durationMinutes/60` часов, поэтому 15 минут даёт `endsAt = startsAt`, 45 — то же, 90 — +1 ч. Из-за этого такие брони не блокируют комнату.
- `POST /bookings`, `PATCH /bookings/{id}` — при пересечении 409 `application/problem+json` с `code: booking-overlap`; сервис отвечает 409 `application/json` с телом `{"error":"overlap"}`.
- `PATCH /bookings/{id}` — чужая бронь (не владелец, не админ) → 403 `not-owner`; сервис переносит и отвечает 200.
- `PATCH /bookings/{id}` — устаревший `version` → 409 `version-conflict`; сервис игнорирует `version` из запроса и отвечает 200.
- `DELETE /bookings/{id}` — повторная отмена → 204 (FR-11); сервис отвечает 500.
- `GET /bookings` — `limit` вне 1..100 → 400; сервис при `limit=0` и `limit=101` отвечает 200, при `limit=-5` — 500.
- `GET /bookings` — пустой результат → `items: []`; сервис отдаёт `items: null`.

**Вне контракта** (тестами не покрыто): `POST /api/v1/internal/rooms/reindex` (только админ) есть в коде, но отсутствует в `api/openapi.yaml`.

**Что не проверено:** изоляция тестов держится на уникальных окнах «комната + время» в общей БД; параллельный запуск нескольких процессов `dotnet test` на одной БД не рассматривался (БД поднимается отдельным контейнером на каждый запуск).
