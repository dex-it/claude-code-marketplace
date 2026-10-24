Тестовый проект готов, `dotnet test` зелёный: 81 прошёл, 14 пропущены (в них расхождения с контрактом), 0 упало. Не закоммичено. Сервис не менял.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект.
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — пакеты только из `Directory.Packages.props`.
- `tests/Bookings.Api.Tests/ApiFixture.cs` — `WebApplicationFactory<Program>` поверх PostgreSQL в Testcontainers (образ `postgres:16-alpine` из локальных). Ключи alice, bob, admin заданы в конфигурации; каждый тест работает в своих сутках, поэтому общая база не мешает.
- `tests/Bookings.Api.Tests/Contract.cs` — проверки форм ответов по контракту (Booking, Room, problem+json, ValidationProblem).
- `tests/Bookings.Api.Tests/Divergences.cs` — тексты причин Skip.
- `tests/Bookings.Api.Tests/RoomsTests.cs` — комнаты и устаревшие брони комнаты.
- `tests/Bookings.Api.Tests/CreateBookingTests.cs` — создание и получение брони.
- `tests/Bookings.Api.Tests/RescheduleBookingTests.cs` — перенос.
- `tests/Bookings.Api.Tests/CancelBookingTests.cs` — отмена.
- `tests/Bookings.Api.Tests/ListBookingsTests.cs` — лента с курсором.

## Описание MR

**BKG-31: интеграционные тесты API по контракту (1.2.0)**

Добавлен проект `tests/Bookings.Api.Tests` (xUnit, `Microsoft.AspNetCore.Mvc.Testing`, Testcontainers.PostgreSql). Нужен Docker с образом `postgres:16-alpine`. Тестами покрыты все операции комнат и броней, включая устаревшую `listRoomBookings`. Проверены успешные ответы, 400/401/403/404/409 с `code` и валидации FR-05, FR-08 и FR-09. Тесты, на которых нашлось расхождение, помечены `Skip` с причиной (`Divergences.cs`). Skip снимается вместе с исправлением сервиса.

**Расхождения реализации с контрактом** (операция — что ждёт контракт — что отвечает сервис):

- createBooking (201) — заголовок `Location: /api/v1/bookings/{id}` — заголовка нет.
- createBooking, rescheduleBooking (409) — problem+json с `code: booking-overlap` — `application/json` с телом `{"error":"overlap"}`.
- createBooking, rescheduleBooking — `endsAt = startsAt + durationMinutes` — считается как `durationMinutes/60` часов целочисленно: для 15, 45 и 90 минут неверно (90 минут даёт +1 ч).
- createBooking (400) — `roomId` длиннее 64 символов отклоняется валидацией — 404 `room-not-found`.
- rescheduleBooking (409) — устаревшая `version` даёт `version-conflict` — версия из запроса не сверяется, перенос выполняется.
- rescheduleBooking (403) — чужую бронь переносит только владелец или администратор, иначе `not-owner` — любой участник переносит чужую бронь (200).
- cancelBooking (204) — повторная отмена уже отменённой брони, FR-11 — 500 (исключение из `Booking.Cancel`).
- listBookings (400) — `limit` вне 1..100 отклоняется — не проверяется, ответ 200.
- listBookings (200) — пустой результат: `items: []` — `items: null`.

**Прочее:**

- Сервис отдаёт моменты времени как `+00:00`, а не `Z`. Это валидный `date-time`, тесты принимают оба варианта.
- В `Booking` есть лишнее поле `createdAt`, которого нет в контракте. Оно не запрещено схемой, поэтому тесты его не проверяют.
- Контракт не описывает ответ на `bookingId`, не являющийся UUID (маршрут даёт 404 без тела). Это не покрыто.

**Как запустить:** `dotnet test` из корня репозитория.
