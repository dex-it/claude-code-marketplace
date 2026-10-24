Добавлен тестовый проект интеграционных тестов по контракту 1.2.0. `dotnet test` из корня зелёный: 63 пройдено, 10 пропущено (пропуски — это найденные расхождения). Сервис не менял, коммита нет.

## Изменённые файлы

- `Bookings.sln` — добавлен проект тестов.
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj`
- `tests/Bookings.Api.Tests/ApiFixture.cs` — сервис на реальном PostgreSQL через Testcontainers (`postgres:16-alpine`) и `WebApplicationFactory`; ключи alice, bob, admin.
- `tests/Bookings.Api.Tests/Api.cs`
- `tests/Bookings.Api.Tests/Asserts.cs`
- `tests/Bookings.Api.Tests/Defects.cs` — причины пропусков.
- `tests/Bookings.Api.Tests/RoomsTests.cs`
- `tests/Bookings.Api.Tests/BookingsTests.cs`

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Что сделано:
- Тестовый проект `tests/Bookings.Api.Tests` (xunit, Mvc.Testing, Testcontainers.PostgreSql — все версии из `Directory.Packages.props`).
- Покрыты все операции комнат и броней: `listRooms`, `getRoom`, `listRoomBookings` (deprecated), `listBookings`, `createBooking`, `getBooking`, `rescheduleBooking`, `cancelBooking`.
- Проверены успешные ответы и ошибки 400/401/403/404/409 с `code`, а также `application/problem+json`.
- Тесты идут на настоящем PostgreSQL, потому что пересечение броней держит exclusion-constraint в БД.
- Запуск требует Docker и локального образа `postgres:16-alpine`.
- Тесты, нашедшие расхождения, помечены `Skip` с причиной из `Defects.cs`. Проверки уже написаны по контракту, после исправления сервиса достаточно снять пропуск.

Расхождения реализации с контрактом (операция — что ждёт контракт — что отвечает сервис):
1. `createBooking` — 201 с обязательным заголовком `Location` — 201 без `Location`.
2. `createBooking`, `rescheduleBooking` — `endsAt = startsAt + durationMinutes` — `endsAt` считается целыми часами (`durationMinutes / 60`): 15 мин → `endsAt = startsAt`, 90 мин → +1 ч.
3. `createBooking` — при пересечении 409 `application/problem+json` с `code: booking-overlap` — 409 `application/json` с телом `{"error":"overlap"}`.
4. `rescheduleBooking` — при пересечении 409 `problem+json` с `code: booking-overlap` — 409 `application/json` с телом `{"error":"overlap"}`.
5. `rescheduleBooking` — устаревшая `version` даёт 409 `version-conflict` — 200, версия не сверяется.
6. `rescheduleBooking` — перенос чужой брони участником даёт 403 `not-owner` (FR-10) — 200, бронь переносится.
7. `cancelBooking` — повторная отмена отменённой брони даёт 204 (FR-11) — 500.
8. `listBookings` — пустой результат это `items: []` — `items: null`.
9. `listBookings` — `limit` вне 1..100 даёт 400 — 200, значение принимается.

Замечание вне перечня: ответ брони содержит поле `createdAt`, которого нет в схеме `Booking`. Контракт `additionalProperties` не запрещает, поэтому расхождением не считаю.

Не покрыто: `GET /api/v1/bookings/{id}` с не-UUID идентификатором. Роутинг отдаёт 404 без тела, а контракт не говорит, какой ответ ожидать. Также не проверялся `POST /api/v1/internal/rooms/reindex`, его нет в контракте.

Я прочитал оба файла дисциплины. Их пункты относятся к самой спецификации (примеры, версионирование, идемпотентность), а не к тестам, поэтому `openapi.yaml` я не правил.
