Тестовый проект готов, `dotnet test` зелёный: 89 прошли, 2 пропущены (расхождения с контрактом, описаны ниже). Ничего не закоммичено.

## Изменённые файлы
- `Bookings.sln` — добавлен тестовый проект.
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — только пакеты из `Directory.Packages.props`: Mvc.Testing, EF InMemory, Test.Sdk, xunit, xunit.runner.visualstudio.
- `tests/Bookings.Api.Tests/BookingsApiFactory.cs`
- `tests/Bookings.Api.Tests/PostgresBehaviourInterceptor.cs`
- `tests/Bookings.Api.Tests/ClientManagedVersionModelCustomizer.cs`
- `tests/Bookings.Api.Tests/ApiTestBase.cs`
- `tests/Bookings.Api.Tests/RoomsTests.cs`
- `tests/Bookings.Api.Tests/BookingsReadTests.cs`
- `tests/Bookings.Api.Tests/BookingsWriteTests.cs`

## Описание MR

**BKG-31. Интеграционные тесты API по контракту 1.2.0**

Тесты поднимают сервис через `WebApplicationFactory<Program>` и проверяют все операции из `api/openapi.yaml`: список и карточка комнат, брони комнаты (устаревшая), лента броней с курсором, создание, чтение, перенос и отмена брони. Для каждой проверены успешные ответы и ответы ошибок из контракта (400, 401, 403, 404, 409). Всего 91 тест: 89 прошли, 2 пропущены.

**Ограничение окружения.** Docker недоступен, а `Testcontainers.PostgreSql` без него не работает, поэтому вместо PostgreSQL используется EF InMemory.
- Два ограничения БД воспроизведены в тестовом интерцепторе: `bookings_no_overlap` и версия строки (xmin).
- Поведение самого PostgreSQL этими тестами не проверяется: порядок `Guid` в курсоре, реальный `EXCLUDE`, гонки за версию.
- Для этого нужен прогон на Testcontainers в CI.

**Расхождения реализации с контрактом** (оба теста есть в проекте и помечены `Skip` с причиной; чтобы включить, достаточно убрать `Skip`):
- `PATCH /api/v1/bookings/{bookingId}` без поля `version` — контракт ждёт 400 с ошибкой по полю `version` (поле `required`), сервис отвечает 409 `version-conflict`: отсутствующая версия превращается в 0.
- `GET /api/v1/bookings/{bookingId}` (то же для PATCH и DELETE) с `bookingId` не в формате uuid — контракт ждёт 404 `booking-not-found` с `code`, сервис отвечает 404 без `code`: ограничение маршрута `{id:guid}` отсекает запрос до контроллера. Подтверждено прогоном только для GET.

Остальное поведение соответствует контракту.

Сервис не менялся и контракт не правился.
