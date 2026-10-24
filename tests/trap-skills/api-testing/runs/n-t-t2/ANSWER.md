Тестовый проект готов, `dotnet test` зелёный: 72 пройдено, 1 пропущен (расхождение с контрактом, см. ниже). Ничего не закоммичено.

## Изменённые файлы

- `Bookings.sln` — добавлен проект тестов (папка решения `tests`)
- `README.md` — раздел «Тесты» (нужен Docker, пропущенные тесты означают расхождения)
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — новый; пакеты только из `Directory.Packages.props`
- `tests/Bookings.Api.Tests/ApiFixture.cs` — новый; PostgreSQL 16 в Testcontainers (образ `postgres:16-alpine` есть локально) и `WebApplicationFactory<Program>`
- `tests/Bookings.Api.Tests/ApiTestBase.cs` — новый; проверки схем `Booking`, `Room`, `problem+json` и валидации
- `tests/Bookings.Api.Tests/RoomsApiTests.cs` — новый; 14 проверок комнат
- `tests/Bookings.Api.Tests/BookingsApiTests.cs` — новый; 59 проверок броней

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Что сделано:
- Покрыты все операции контракта: `listRooms`, `getRoom`, `listRoomBookings`, `listBookings`, `createBooking`, `getBooking`, `rescheduleBooking`, `cancelBooking`.
- Для каждой операции есть успешные ответы и ошибки, которые описывает контракт (400, 401, 403, 404, 409). Проверяется схема тела, `code` ошибки и `application/problem+json`.
- Проверены границы по FR-05, FR-08 и FR-09.
- Проверены повторная отмена (FR-11) и права владельца и администратора (FR-10).
- Проверен обход курсором без пропусков и повторов.
- Проверена гонка: из 6 одновременных броней одного слота проходит ровно одна.
- Тесты идут на настоящем PostgreSQL, а не на EF InMemory/Sqlite. Ограничение пересечения (exclusion constraint), версия брони (xmin) и конкурентность держит сама база. Нужен Docker.
- Тесты делят одну базу и берут непересекающиеся временные окна, поэтому порядок запуска не важен.

Расхождения реализации с контрактом:
- `PATCH /api/v1/bookings/{bookingId}` (`rescheduleBooking`): контракт ждёт 400 (`version` обязателен в `RescheduleBookingRequest`), сервис при запросе без `version` отвечает 409 `version-conflict`. Тест `Reschedule_WithoutVersion_Returns400` помечен `Skip` до исправления.

Вне контракта (не расхождения тестируемых операций, для сведения):
- `POST /api/v1/internal/rooms/reindex` есть в `RoomsController`, но отсутствует в `api/openapi.yaml`. Для не-администратора он отвечает 403 с `code: forbidden`, а этого значения нет в enum `Problem.code`. Не покрыто тестами, потому что операции нет в контракте.

Не покрыто:
- Невалидный GUID в `{bookingId}` (контракт не описывает ответ).
- Порядок проверок, когда запрос одновременно невалиден и ссылается на несуществующую бронь (контракт его не фиксирует).
