Тестовый проект заведён, `dotnet test` зелёный: 81 пройден, 4 пропущены (Skip, по одному на расхождение с контрактом). Ничего не закоммичено.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj`
- `tests/Bookings.Api.Tests/ApiFixture.cs`
- `tests/Bookings.Api.Tests/ApiTestBase.cs`
- `tests/Bookings.Api.Tests/RoomsTests.cs`
- `tests/Bookings.Api.Tests/BookingsCreateTests.cs`
- `tests/Bookings.Api.Tests/BookingsReadTests.cs`
- `tests/Bookings.Api.Tests/BookingsChangeTests.cs`

## Описание MR

**BKG-31. Интеграционные тесты API по контракту 1.2.0**

Что сделано:
- Новый проект `tests/Bookings.Api.Tests` (xunit, `WebApplicationFactory<Program>`). Все пакеты — из `Directory.Packages.props`, новых версий нет.
- База — настоящий PostgreSQL 16 через Testcontainers (образ `postgres:16-alpine`). Пересечения броней держит exclusion constraint, версию — `xmin`, поэтому EF InMemory и Sqlite не подходят.
- Покрыты все операции комнат и броней: `listRooms`, `getRoom`, `listRoomBookings` (deprecated), `listBookings`, `createBooking`, `getBooking`, `rescheduleBooking`, `cancelBooking`. Проверены успешные ответы и все ошибки, которые контракт описывает: 400, 401, 403, 404, 409 (`booking-overlap`, `version-conflict`, `booking-cancelled`).
- Отдельно проверены:
  - гонки (параллельное создание на один слот, параллельный перенос с одной версией);
  - границы FR-05 и FR-08;
  - обход курсором без пропусков и повторов;
  - идемпотентность повторной отмены (FR-11).
- Изоляция тестов: каждый тест создаёт свою комнату.

Запуск: `dotnet test`. Нужен Docker и локальный образ `postgres:16-alpine` (плюс `testcontainers/ryuk`).

**Расхождения реализации с контрактом** (тесты написаны по контракту и помечены `Skip` с этим же текстом; после исправления сервиса снять `Skip`):

- `GET /api/v1/bookings/{bookingId}`, `PATCH …/{bookingId}`, `DELETE …/{bookingId}`: контракт ждёт при `bookingId`, не являющемся uuid, 404 `problem+json` с `code: booking-not-found`; сервис отвечает 404 `problem+json` без `code`. Причина — ограничение маршрута `{id:guid}`.
- `GET /api/v1/bookings?roomId=<65 символов>`: контракт ждёт 400 (`maxLength: 64`); сервис отвечает 200 с пустым `items`.
- `POST /api/v1/bookings` с `roomId` длиннее 64 символов: контракт ждёт 400 (`maxLength: 64`); сервис отвечает 404 `room-not-found`.
- `POST /api/v1/bookings` без обязательного поля (например, без `roomId`): контракт ждёт ключи `errors` в camelCase (`roomId`); сервис отвечает с ключом `RoomId`. Для ошибок разбора типа JSON ключи такие же: `$.version`, `request`.

**Не покрыто:** `POST /api/v1/internal/rooms/reindex` — его нет в контракте. Курсор длиннее 256 символов (`maxLength: 256`) не проверен: любая такая строка и так не декодируется и даёт 400, поэтому отдельно этот предел не отличить.
