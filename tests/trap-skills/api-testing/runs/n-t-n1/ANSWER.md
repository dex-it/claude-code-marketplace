Тестовый проект готов, `dotnet test` зелёный: 77 прошли, 2 пропущены (это найденные расхождения), 0 упали. Ничего не закоммичено.

## Изменённые файлы

- `Bookings.sln` — добавлен проект тестов в папку решения `tests`
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — пакеты только из `Directory.Packages.props`
- `tests/Bookings.Api.Tests/ApiFixture.cs` — PostgreSQL в Testcontainers (образ `postgres:16`, есть локально) и приложение через `WebApplicationFactory`; тесты не пересекаются по слотам времени
- `tests/Bookings.Api.Tests/ApiTestBase.cs` — общие помощники и проверки форм `Problem`, `ValidationProblem`, `Booking`
- `tests/Bookings.Api.Tests/AuthTests.cs` — 401 без ключа и с неизвестным ключом на всех 8 операциях
- `tests/Bookings.Api.Tests/RoomsTests.cs` — `listRooms`, `getRoom`
- `tests/Bookings.Api.Tests/BookingsTests.cs` — `createBooking`, `getBooking`
- `tests/Bookings.Api.Tests/ListBookingsTests.cs` — `listBookings` (курсор, период, отменённые), `listRoomBookings`
- `tests/Bookings.Api.Tests/RescheduleBookingTests.cs` — `rescheduleBooking`
- `tests/Bookings.Api.Tests/CancelBookingTests.cs` — `cancelBooking`

Тесты запускаются на реальной БД: запрет пересечений (FR-09) и версия брони держатся на ограничении PostgreSQL, на InMemory их не проверить. Нужен запущенный Docker.

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Добавлен проект `tests/Bookings.Api.Tests` (xUnit, `WebApplicationFactory`, Testcontainers PostgreSQL). Покрыты все операции комнат и броней: успешные ответы, ошибки 400, 401, 403, 404, 409, границы валидации (FR-05, FR-08), пересечения и смежные брони (FR-09), версия при переносе (FR-06), права владельца и администратора (FR-10), повторная отмена (FR-11), курсорная пагинация и устаревшая операция `listRoomBookings`. Ответы сверяются со схемами контракта: обязательные поля, границы, `endsAt = startsAt + durationMinutes`, `application/problem+json` с `code`.

Расхождения реализации с контрактом (операция — что ждёт контракт — что отвечает сервис):

- `PATCH /api/v1/bookings/{bookingId}` — тело без обязательного `version` должно дать 400 `ValidationProblem` — сервис подставляет 0 и отвечает 409 `version-conflict`. Тест `Reschedule_without_version_is_rejected`, пропущен.
- `GET /api/v1/bookings/{bookingId}` при `bookingId`, не являющемся UUID (например `not-a-guid`) — контракт описывает только 404 `Problem` с `code` `booking-not-found` — сервис отвечает 404 без поля `code`. Тест `GetBooking_malformed_id_is_not_found_problem`, пропущен. Аналогичные запросы `PATCH` и `DELETE` с таким id не проверялись.

Два теста помечены `Skip` с описанием причины; их нужно включить после исправления сервиса или уточнения контракта.

Что не покрыто тестами, но стоит знать:

- `POST /api/v1/internal/rooms/reindex` есть в сервисе, но отсутствует в `api/openapi.yaml`.
- Для этой операции сервис может вернуть 403 с `code: forbidden`, а в enum `Problem.code` такого значения нет.

Замечания по самому контракту:

- Нет описания повтора для `POST /api/v1/bookings` после потерянного ответа: повтор даёт 409 `booking-overlap` на собственную бронь.
- У операций нет примеров ошибочных ответов.

Это не покрыто тестами и в рамках задачи не менялось.
