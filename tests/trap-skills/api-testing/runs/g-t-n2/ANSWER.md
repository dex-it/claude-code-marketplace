Интеграционные тесты по контракту 1.2.0 готовы, `dotnet test` зелёный: 66 прошло, 9 пропущено. Девять пропущенных проверяют расхождения реализации с контрактом и по умолчанию отключены. Ничего не закоммичено.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект.
- `README.md` — раздел «Тесты».
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — xunit, Mvc.Testing и Testcontainers.PostgreSql, версии из `Directory.Packages.props`.
- `tests/Bookings.Api.Tests/ApiFixture.cs` — приложение поверх одноразового PostgreSQL 16 (нужен ограничитель пересечений) и тестовые ключи alice, bob и admin.
- `tests/Bookings.Api.Tests/ApiTestBase.cs` — клиенты, свободные временные окна и проверки problem+json.
- `tests/Bookings.Api.Tests/KnownDefectFactAttribute.cs` — атрибуты для тестов известных расхождений.
- `tests/Bookings.Api.Tests/RoomsTests.cs` — комнаты и устаревший `/rooms/{id}/bookings`.
- `tests/Bookings.Api.Tests/BookingsTests.cs` — создание, чтение, перенос, отмена и лента броней.

## Описание MR

**BKG-31. Интеграционные тесты API по контракту**

Добавлен проект `tests/Bookings.Api.Tests`: 75 тестов по операциям комнат и броней — успешные ответы и ответы ошибок 400/401/403/404/409, которые описывает контракт. Тесты идут против реального PostgreSQL в Testcontainers, чтобы работал ограничитель пересечений FR-09. Образ `postgres:16-alpine` и `ryuk` уже есть локально.

Тесты, на которых сервис расходится с контрактом, помечены `KnownDefectFact`/`KnownDefectTheory` и по умолчанию пропускаются, чтобы набор был зелёным. Они запускаются командой `dotnet test -e RUN_KNOWN_DEFECTS=1`; при этом падают ровно 10 проверок (9 пропущенных тестов, один из них — `Theory` на два значения) и ничего больше. Исправлять сервис в этом MR не требовалось.

**Расхождения реализации с контрактом** (операция — что ждёт контракт — что отвечает сервис):

- `createBooking`, `rescheduleBooking` — `endsAt = startsAt + durationMinutes` — сервис считает по целым часам: 90 минут дают +1 ч, а 15 или 30 минут дают `endsAt == startsAt`. Из-за этого такие брони пропадают из ленты при `from` = их начало.
- `createBooking` — 201 с заголовком `Location: /api/v1/bookings/{id}` — заголовка нет.
- `createBooking` — 409 `application/problem+json` с `code: booking-overlap` — 409 `application/json` с телом `{"error":"overlap"}`.
- `rescheduleBooking` — перенос на занятое время даёт 409 `booking-overlap` в problem+json — 409 `application/json` с `{"error":"overlap"}`.
- `rescheduleBooking` — устаревший `version` даёт 409 `version-conflict` (FR-06) — версия не проверяется, бронь переносится с 200.
- `rescheduleBooking` — перенос чужой брони участником даёт 403 `not-owner` (FR-10) — перенос выполняется с 200 для любого участника.
- `cancelBooking` — повторная отмена даёт 204 (FR-11) — 500 (необработанное `InvalidOperationException`).
- `listBookings` — пустой результат даёт `items: []` — `items: null`.
- `listBookings` — `limit` вне 1..100 даёт 400 `ValidationProblem` — 200 (`limit=0` вернёт одну бронь, `limit=101` не ограничивается).

**Замечания вне перечня расхождений:**

- Сервис отдаёт в `Booking` поле `createdAt`, которого нет в схеме контракта.
- В коде есть операция `POST /api/v1/internal/rooms/reindex` (admin), которой нет в `openapi.yaml`. Тестами не покрыта.

**Как запустить:** `dotnet test` (нужен Docker). Для проверки расхождений — `dotnet test -e RUN_KNOWN_DEFECTS=1`.
