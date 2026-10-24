Тестовый проект создан, `dotnet test` зелёный: 67 прошли, 12 пропущены (по ним найдены расхождения с контрактом), 0 упали. Ничего не закоммичено. Код сервиса не менялся.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект (папка решения `tests`).
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — пакеты только из `Directory.Packages.props`: Mvc.Testing, Test.Sdk, Testcontainers.PostgreSql, xunit, xunit.runner.visualstudio.
- `tests/Bookings.Api.Tests/ApiFixture.cs` — поднимает `WebApplicationFactory` на настоящем PostgreSQL в Testcontainers (образ `postgres:16-alpine` есть локально).
- `tests/Bookings.Api.Tests/ProblemAssert.cs` — проверки `problem+json` (status, code, title, type) и ответов 400 (`errors` по полю).
- `tests/Bookings.Api.Tests/AuthTests.cs` — 401 без ключа и с неизвестным ключом на все 8 операций (FR-12).
- `tests/Bookings.Api.Tests/RoomsTests.cs` — комнаты и устаревшая лента `/rooms/{id}/bookings`.
- `tests/Bookings.Api.Tests/BookingsTests.cs` — создание, чтение, перенос, отмена и лента броней.
- `tests/Bookings.Api.Tests/Discrepancy.cs` — причины пропуска тестов.
- `tests/Bookings.Api.Tests/GlobalUsings.cs` — глобальные using для тестов.

## Описание MR

**BKG-31. Интеграционные тесты API по контракту 1.2.0**

Что сделано:
- Добавлен проект `tests/Bookings.Api.Tests` (xunit, `WebApplicationFactory`). Покрыты все операции комнат и броней из `api/openapi.yaml`: успешные ответы, ошибки 400/401/403/404/409, границы FR-05/FR-08, курсорная пагинация, фильтры `from`/`to`, конкурентное создание в один слот.
- Тесты идут на настоящем PostgreSQL (Testcontainers), а не на EF InMemory/Sqlite. Пересечение броней держит exclusion constraint, версию строки держит `xmin`, поэтому на подменной базе это не проверить.
- Для запуска нужен Docker и локальный образ `postgres:16-alpine`.
- Тесты, на которых реализация расходится с контрактом, помечены `Skip` с причиной (`Discrepancy.cs`). Тело теста описывает поведение по контракту, пропуск снимают вместе с исправлением сервиса. Сервис в этом MR не менялся.

Расхождения реализации с контрактом (операция — что ждёт контракт — что отвечает сервис):
- `POST /api/v1/bookings` — `201` с заголовком `Location: /api/v1/bookings/{id}` — `201` без `Location`.
- `POST /api/v1/bookings`, `PATCH /api/v1/bookings/{id}` — `endsAt = startsAt + durationMinutes` — `startsAt` плюс целые часы (`durationMinutes / 60`): 90 минут → +1 ч, 30 минут → `endsAt == startsAt`. Из-за этого такие брони выпадают из фильтра `from`.
- `POST /api/v1/bookings` — `409 application/problem+json`, `code: booking-overlap` — `409 application/json` `{"error":"overlap"}`.
- `PATCH /api/v1/bookings/{id}` (перенос на занятое время) — `409 problem+json`, `booking-overlap` — `409 application/json` `{"error":"overlap"}`.
- `PATCH /api/v1/bookings/{id}` (чужая бронь, не администратор) — `403 not-owner` (FR-10) — `200`, бронь перенесена.
- `PATCH /api/v1/bookings/{id}` (устаревший `version`) — `409 version-conflict` (FR-06) — `200`, `version` из запроса не проверяется.
- `DELETE /api/v1/bookings/{id}` (повторная отмена) — `204` (FR-11) — `500`.
- `GET /api/v1/bookings` (пустой результат) — `items: []` — `items: null`.
- `GET /api/v1/bookings?limit=0|101|-1` — `400` с `errors.limit` — `200`.
- `POST /api/v1/bookings` (в теле нет обязательного поля, например `title`) — `400`, поле в `errors` в camelCase (`title`) — `400`, поле в PascalCase (`Title`).

Не покрыто: `POST /api/v1/internal/rooms/reindex` — в контракте его нет, в задачу он не входит. Для `GET /api/v1/bookings/{id}` с не-UUID в пути контракт ответ не описывает (сервис отвечает 404 из-за route constraint), поэтому его я не проверял.

Наблюдения:
- Параллельные запросы в тестах используют общую базу и разные временные слоты (`NextSlot()`), поэтому тесты не зависят друг от друга и порядка запуска.
- Тесты привязаны к текущему времени (брони «завтра» и позже, в пределах 90 дней).
- Предупреждение об устаревшем конструкторе `PostgreSqlBuilder()` убрано, образ задан в конструкторе.
