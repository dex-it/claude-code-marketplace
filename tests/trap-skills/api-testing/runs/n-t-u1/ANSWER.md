Тестовый проект добавлен, `dotnet test` зелёный: 85 пройдено, 5 пропущено (это найденные расхождения с контрактом). Изменения не закоммичены.

## Изменённые файлы
- `Bookings.sln` — добавлен тестовый проект.
- `README.md` — раздел «Тесты».
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — только пакеты из `Directory.Packages.props`.
- `tests/Bookings.Api.Tests/BookingsApiFactory.cs` — фабрика на PostgreSQL 16 в контейнере (Testcontainers, образ `postgres:16-alpine`, он есть локально); у сервиса зафиксированы часы и тестовые ключи.
- `tests/Bookings.Api.Tests/ApiTestBase.cs`, `ApiClientExtensions.cs` — общие проверки и хелперы.
- `tests/Bookings.Api.Tests/RoomsTests.cs`, `BookingsTests.cs` — 90 тестов.

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Покрыты все операции комнат и броней: `listRooms`, `getRoom`, `listRoomBookings`, `listBookings`, `createBooking`, `getBooking`, `rescheduleBooking`, `cancelBooking`. Проверены успешные ответы и все ошибки, которые контракт описывает: 400, 401, 403, 404, 409 с `code`. Отдельно проверены границы FR-05 и FR-08, повторная отмена (FR-11), курсорная пагинация без пропусков и повторов, параллельное создание и перенос.

Тесты идут на настоящем PostgreSQL. Пересечение броней держит exclusion-constraint, версия брони — `xmin`; на InMemory или Sqlite эти ответы не воспроизвести. Каждый тест работает в своей комнате.

**Для запуска нужен Docker.** Без него `dotnet test` не стартует.

**Расхождения реализации с контрактом** (тесты помечены `Skip` с причиной в атрибуте; каждое подтверждено прогоном без `Skip`):
- `createBooking`: `roomId` длиннее 64 символов — контракт ждёт 400 (`maxLength: 64`), сервис отвечает 404 `room-not-found`.
- `listBookings`: `roomId` длиннее 64 символов — контракт ждёт 400, сервис отвечает 200 с пустой страницей.
- `listBookings`: `cursor` длиннее 256 символов — контракт ждёт 400 (`maxLength: 256`), сервис отвечает 200 на любой разбираемый курсор.
- `getBooking`, `rescheduleBooking`, `cancelBooking`: `bookingId` не uuid — контракт ждёт 404 `booking-not-found`, сервис отвечает 404 без `code` (маршрут `{id:guid}` не совпал). Проверен только `getBooking`; для `PATCH` и `DELETE` поведение такое же по маршруту, но тестом не подтверждено.
- `rescheduleBooking`: ошибка разбора тела (например, `version: -1`) — контракт ждёт `errors` по полю в camelCase (`version`), сервис отвечает ключами `request` и `$.version`.

**Замечание вне scope:** в реализации есть `POST /api/v1/internal/rooms/reindex`, которого нет в контракте. Для не-админа он отвечает 403 с `code: forbidden`, а этого значения нет в enum `Problem.code`. Тестами не покрыто, так как задача про `/rooms` и `/bookings`.

**Не проверялось:** `Location` у `createBooking` сервис отдаёт абсолютным URL, а контракт в описании называет путь. Формат `uri-reference` это допускает, поэтому тест сравнивает путь и расхождением не считается.
