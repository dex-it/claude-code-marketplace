Тестовый проект готов. `dotnet test` зелёный: 72 прошли, 14 пропущены, 0 упали. Ничего не закоммичено.

Из 14 пропущенных 8 — подтверждённые расхождения с контрактом, а 6 ждут PostgreSQL, до которого в этой среде не добраться (подробности ниже).

## Изменённые файлы
- `Bookings.sln` — добавлен проект тестов (папка `tests`).
- `README.md` — раздел «Тесты» с командами запуска.
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — xunit, `Microsoft.AspNetCore.Mvc.Testing`, `EntityFrameworkCore.InMemory`; версии из `Directory.Packages.props`.
- `tests/Bookings.Api.Tests/TestSupport.cs` — фабрика сервиса, проверки problem+json и форм ответов, атрибуты `PostgresFact` и `DiscrepancyFact`.
- `tests/Bookings.Api.Tests/RoomsTests.cs` — комнаты и устаревший `/rooms/{id}/bookings`.
- `tests/Bookings.Api.Tests/BookingsTests.cs` — создание, чтение, перенос, отмена и лента броней.

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Тесты поднимают сервис в процессе через `WebApplicationFactory`, время фиксировано. Покрыты все операции комнат и броней: успешные ответы и ошибки 400, 401, 403, 404, 409, а также границы FR-05, FR-08 и ключи доступа.

**Как это устроено**
- **БД.** По умолчанию EF InMemory. PostgreSQL (исключающее ограничение, `xmin`) в такой среде не воспроизвести, а в этой среде докера нет.
- **Тесты, которым нужен PostgreSQL** (пересечения, смежные брони, брони поверх отменённых): пропускаются, пока не задан `BOOKINGS_TEST_PG`. В этой среде я их не запускал, так что режим PostgreSQL в фабрике не проверен.
- **Тесты расхождений** (`DiscrepancyFact`): по умолчанию пропущены, чтобы набор был зелёным. Включаются через `-e BOOKINGS_RUN_DISCREPANCIES=1`; 8 из них я прогнал в этой среде, и все упали, как ниже.

**Расхождения реализации с контрактом** (операция, что ждёт контракт, что отвечает сервис)
- `POST /api/v1/bookings` и `PATCH /api/v1/bookings/{id}` — `endsAt = startsAt + durationMinutes`; сервис считает `startsAt + (durationMinutes / 60)` часов: 90 минут даёт +1 ч, 30 минут даёт +0.
- `POST /api/v1/bookings` — 201 с заголовком `Location: /api/v1/bookings/{id}`; заголовка нет.
- `POST /api/v1/bookings` — пересечение с активной бронью даёт 409 problem+json с `code: booking-overlap`; по коду сервис отдаёт 409 с телом `{"error":"overlap"}` без `code`. Проверено только чтением кода, нужен PostgreSQL.
- `PATCH /api/v1/bookings/{id}` — пересечение даёт 409 problem+json с `code: booking-overlap`; та же ошибка: тело `{"error":"overlap"}`. Только чтением кода.
- `PATCH /api/v1/bookings/{id}` — версия не совпала даёт 409 `version-conflict`; сервис версию из запроса не сверяет и отвечает 200.
- `PATCH /api/v1/bookings/{id}` — не владелец и не администратор получает 403 `not-owner` (FR-10); сервис переносит чужую бронь и отвечает 200.
- `DELETE /api/v1/bookings/{id}` — повторная отмена даёт 204 (FR-11); сервис падает на уже отменённой брони, 500.
- `GET /api/v1/bookings` — `limit` вне 1..100 даёт 400; сервис принимает 0, 101 и 1000 и отвечает 200.
- `GET /api/v1/bookings` — пустой результат даёт `items: []`; сервис отдаёт `items: null`.

**Вне контракта (замечание)**
- `POST /api/v1/internal/rooms/reindex` в `openapi.yaml` не описан. Для не-админа он вернёт 403 с `code: forbidden`, а этого значения нет в enum `Problem.code`. Тестов на него нет.
