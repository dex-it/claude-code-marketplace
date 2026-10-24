Задача BKG-31 выполнена в рабочем дереве, ничего не закоммичено. `dotnet test`: 74 пройдено, 4 пропущено, 0 упало.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект
- `README.md` — раздел «Тесты» (нужен запущенный Docker)
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — новый
- `tests/Bookings.Api.Tests/ApiFixture.cs` — новый, PostgreSQL 16 в контейнере и приложение
- `tests/Bookings.Api.Tests/ApiTestBase.cs` — новый, клиенты, свободные окна времени, проверки problem+json
- `tests/Bookings.Api.Tests/Models.cs` — новый
- `tests/Bookings.Api.Tests/RoomsTests.cs` — новый
- `tests/Bookings.Api.Tests/BookingsCreateTests.cs` — новый
- `tests/Bookings.Api.Tests/BookingsReadTests.cs` — новый
- `tests/Bookings.Api.Tests/BookingsChangeTests.cs` — новый

## Описание MR

**BKG-31. Интеграционные тесты API по контракту 1.2.0**

- Новый проект `tests/Bookings.Api.Tests` (xunit, `WebApplicationFactory`). Пакеты только из `Directory.Packages.props`, код сервиса не менялся.
- Тесты идут на настоящем PostgreSQL 16 через Testcontainers, образ `postgres:16-alpine`. Пересечение броней держит exclusion constraint, версию переноса — xmin, поэтому EF InMemory и Sqlite не подходят (дисциплина `api-testing`).
- Покрыты все операции комнат и броней: успешные ответы и ошибки 400, 401, 403, 404, 409 с проверкой `code`. Отдельно проверены:
  - гонки при создании и при переносе с одной версией (выигрывает один запрос);
  - границы периода `from`/`to`;
  - обход ленты курсором;
  - повторная отмена.
- Тесты с расхождениями описывают поведение по контракту и помечены `Skip = KnownDeviation`, чтобы набор оставался зелёным. Их нужно включить после исправления сервиса.
- Контракт и `CHANGELOG` не менялись.

**Расхождения реализации с контрактом**

- `createBooking` — `roomId` длиннее 64 символов: контракт ждёт 400 (maxLength 64), сервис отвечает 404 `room-not-found`.
- `createBooking` — в теле нет `title`: контракт ждёт 400 с ключом `title` (camelCase), сервис отвечает 400 с ключом `Title` (PascalCase).
- `rescheduleBooking` — в теле нет `version` (поле required): контракт ждёт 400, сервис отвечает 409 `version-conflict`.
- `getBooking` — `bookingId` не uuid, например `/api/v1/bookings/not-a-uuid`: контракт описывает 404 problem+json с `code`, сервис отвечает 404 без `code`.

Не относится к контракту, но стоит учесть: `POST /api/v1/internal/rooms/reindex` есть в коде и не описан в `openapi.yaml`. Тестами он не покрыт.
