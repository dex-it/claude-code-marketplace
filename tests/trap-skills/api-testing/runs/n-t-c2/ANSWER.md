Интеграционные тесты API по контракту написаны, `dotnet test` зелёный: 88 прошли, 4 пропущены (расхождения с контрактом, см. ниже). Ничего не закоммичено.

## Изменённые файлы

- `Bookings.sln` — добавлен тестовый проект (папка решения `tests`)
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — только пакеты из `Directory.Packages.props`
- `tests/Bookings.Api.Tests/ApiFactory.cs` — `WebApplicationFactory<Program>` поверх PostgreSQL 16 в Testcontainers (образ `postgres:16-alpine` есть локально)
- `tests/Bookings.Api.Tests/Support.cs` — окна времени для тестов и проверки формы ответов по схемам контракта
- `tests/Bookings.Api.Tests/AuthTests.cs` — 401 `unauthorized` для всех 8 операций без ключа и с неизвестным ключом
- `tests/Bookings.Api.Tests/RoomsTests.cs` — комнаты, включая устаревшие брони комнаты
- `tests/Bookings.Api.Tests/BookingsTests.cs` — создание, получение, перенос, отмена, лента с курсором

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Добавлен проект `tests/Bookings.Api.Tests` (xUnit, `Microsoft.AspNetCore.Mvc.Testing`, `Testcontainers.PostgreSql`). Для запуска нужен Docker: ограничение на пересечения и версия брони живут в PostgreSQL, на InMemory их не проверить.

Покрыто:
- **Комнаты:** список с `limit`/`offset`, карточка, брони комнаты (устаревшая операция).
- **Брони:** создание, получение, перенос, отмена, лента с курсором.
- **Ответы:** успешные и ошибочные (400, 401, 403, 404, 409).
- **Бизнес-правила:** границы FR-05 и FR-08, пересечения (FR-09), права владельца и администратора (FR-10), повторная отмена (FR-11), ключ доступа (FR-12), порядок и курсор ленты, в том числе при одинаковом `startsAt`.

Тесты не зависят друг от друга: каждому отведены свои сутки. Тесты с найденными расхождениями помечены `Skip` с описанием; после исправления сервиса достаточно снять `Skip`.

**Расхождения реализации с контрактом:**
- `POST /api/v1/bookings` с `roomId` длиннее 64 символов: контракт ждёт 400 (`maxLength: 64`), сервис отвечает 404 `room-not-found`.
- `POST /api/v1/bookings` без обязательного `title`: контракт ждёт 400 с ключом `errors` в camelCase (`title`), сервис отвечает 400 с ключом `Title`.
- `GET /api/v1/bookings/{bookingId}` с не-UUID: контракт ждёт 404 problem+json с `code: booking-not-found`, сервис отвечает 404 без `code`.
- `PATCH /api/v1/bookings/{bookingId}` без `version` (обязательное поле): контракт ждёт 400, сервис отвечает 409 `version-conflict`.

**Вне объёма:** `POST /api/v1/internal/rooms/reindex` (только для администратора) в контракте не описан. Тестами не покрыт, решение о контракте — за командой.
