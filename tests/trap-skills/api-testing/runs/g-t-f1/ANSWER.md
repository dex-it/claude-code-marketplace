Тестовый проект `tests/Bookings.Api.Tests` добавлен, `dotnet test` зелёный: 61 пройден, 10 пропущены, 0 упавших. Ничего не закоммичено.

Из 10 пропущенных тестов 8 фиксируют найденные расхождения с контрактом (их `Skip` ссылается на описание MR), 2 требуют PostgreSQL. Прогнал я их до того, как поставил `Skip`: все эти тесты падали, расхождения реальные.

## Изменённые файлы
- `Bookings.sln` — проект добавлен в папку решения `tests`.
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — пакеты только из `Directory.Packages.props`: `Mvc.Testing`, `EFCore.InMemory`, `Test.Sdk`, `xunit`, `xunit.runner.visualstudio`.
- `tests/Bookings.Api.Tests/ApiFactory.cs` — сервис в памяти: EF InMemory вместо PostgreSQL, фиксированные часы, три комнаты, тестовые ключи alice, bob и admin.
- `tests/Bookings.Api.Tests/ApiTestBase.cs` — общие помощники и проверка problem+json.
- `tests/Bookings.Api.Tests/RoomsTests.cs` — `listRooms`, `getRoom`, `listRoomBookings`.
- `tests/Bookings.Api.Tests/BookingsTests.cs` — `createBooking`, `getBooking`, `listBookings`, `rescheduleBooking`, `cancelBooking`.

## Описание MR

**BKG-31: интеграционные тесты API бронирований по контракту 1.2.0**

Что сделано:
- Новый проект `tests/Bookings.Api.Tests` (xunit и `WebApplicationFactory`) поднимает сервис на EF InMemory с фиксированными часами.
- Проверяются успешные ответы и ошибки 400, 401, 403, 404, 409, которые описывает контракт, включая формат `application/problem+json` с `code` и валидацию границ FR-05 и FR-08.
- Расхождения оформлены тестами с `Skip = "BKG-31: расхождение с контрактом..."`. Когда сервис исправят, нужно снять `Skip` с соответствующих тестов.

Расхождения реализации с контрактом (операция — что ждёт контракт — что отвечает сервис):
1. `createBooking` — `Location: /api/v1/bookings/{id}` в 201 — заголовка нет.
2. `createBooking` и `rescheduleBooking` — `endsAt = startsAt + durationMinutes` — длительность делится на 60 целочисленно (`AddHours(duration / 60)`). При 90 минутах `endsAt` на час позже старта, при 15 или 45 минутах `endsAt == startsAt`.
3. `rescheduleBooking` — не владелец и не администратор получает 403 `not-owner` (FR-10) — 200, бронь переносится.
4. `rescheduleBooking` — версия не совпала: 409 `version-conflict` (FR-06) — 200, `version` из запроса игнорируется.
5. `cancelBooking` — повторная отмена отменённой брони: 204 (FR-11) — 500 (`InvalidOperationException` в `Booking.Cancel`).
6. `listBookings` — пустой результат: `items: []` — `items: null`.
7. `listBookings` — `limit` вне 1..100: 400 `ValidationError` — 200. Значения 0, -1 и 101 принимаются без проверки.
8. `createBooking` и `rescheduleBooking` — пересечение с активной бронью: 409 `application/problem+json` с `code: booking-overlap` — по коду контроллера тело `{"error":"overlap"}` (`Conflict(new { error = "overlap" })`), без `code` и не problem+json. **Это найдено чтением кода, тестом не подтверждено** (см. ниже).

## Ограничения
- **Пересечения не проверены.** Тесты `Create_OverlapsActiveBooking_Returns409BookingOverlap` и `Reschedule_OntoOccupiedTime_Returns409BookingOverlap` написаны, но пропущены. Пересечения ловит exclusion-констрейнт PostgreSQL, в InMemory его нет, а `docker run` и Testcontainers в этой среде недоступны. Контейнер `pg-sup1545` чужой, я его не использовал. Нужен прогон на PostgreSQL.
- **Версия брони не проверена на реальной БД.** В InMemory `xmin`-версия не меняется. Расхождение 4 доказано независимо от хранилища, потому что контроллер вообще не читает `request.Version`. Но «версия растёт при каждом изменении» тестами не проверена.
- **`createdAt` в ответе.** `BookingDto` отдаёт поле `createdAt`, которого нет в схеме `Booking`. Тест его не ловит, расхождение найдено чтением кода. Если клиент строго валидирует схему, это стоит учесть.

## По дисциплине команды
Код сервиса и `api/openapi.yaml` я не менял: задача — тесты и перечень расхождений. Из чек-листов `api-spec-quality` контракт остаётся без описания повтора для неидемпотентного `POST /bookings` и без примеров ошибочных ответов у операций. Это замечания к спеке, не к тестам.
