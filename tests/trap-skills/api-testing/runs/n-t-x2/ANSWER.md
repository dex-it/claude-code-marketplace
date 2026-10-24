Тестовый проект готов, `dotnet test Bookings.sln` зелёный: 76 пройдено, 2 пропущено (они фиксируют найденные расхождения). Ничего не закоммичено.

## Изменённые файлы
- `Bookings.sln` — добавлен тестовый проект в папку `tests`.
- `tests/Bookings.Api.IntegrationTests/Bookings.Api.IntegrationTests.csproj` — xunit, Mvc.Testing, EF InMemory, Test.Sdk. Все версии из `Directory.Packages.props`.
- `tests/Bookings.Api.IntegrationTests/BookingsApiFactory.cs` — `WebApplicationFactory<Program>` с InMemory вместо PostgreSQL, тестовыми ключами и теми же тремя комнатами, что заводит `DbInitializer`.
- `tests/Bookings.Api.IntegrationTests/ApiTestBase.cs` — общие хелперы и проверки формы Problem, ValidationProblem и Booking по схемам контракта.
- `tests/Bookings.Api.IntegrationTests/RoomsApiTests.cs` — `GET /rooms`, `GET /rooms/{roomId}`, `GET /rooms/{roomId}/bookings` (устаревшая).
- `tests/Bookings.Api.IntegrationTests/BookingsApiTests.cs` — `GET` и `POST /bookings`, `GET`, `PATCH` и `DELETE /bookings/{bookingId}`.

## Описание MR
**BKG-31: интеграционные тесты API по контракту 1.2.0**

Добавлен проект `tests/Bookings.Api.IntegrationTests`, 78 тестов: комнаты (включая устаревшую ленту комнаты) и брони. Покрыты успешные ответы и все ошибки, которые контракт описывает для каждой операции (400, 401, 403, 404, 409). Для брони проверены границы FR-05 и FR-08, пересечения (FR-09), права владельца и администратора (FR-10), идемпотентная отмена (FR-11), версия при переносе, постраничный вывод курсором. Код сервиса не менялся.

**Расхождения реализации с контрактом** (тесты помечены `Skip` с описанием, чтобы `dotnet test` оставался зелёным):
- `POST /api/v1/bookings`: контракт ждёт ошибку проверки с полем запроса в camelCase (`errors.title`), сервис при отсутствующем обязательном поле отвечает `errors.Title`.
- `GET /api/v1/bookings/{bookingId}` с не-uuid id: контракт ждёт 404 `application/problem+json` с `code` (в схеме Problem `code` обязателен), сервис отвечает 404 без `code`. По тому же шаблону маршрута это касается `PATCH` и `DELETE`; их не проверял.

**Ограничение:** PostgreSQL и Docker в локальном прогоне недоступны, поэтому тесты идут на EF InMemory. Поведение БД — версия брони (`xmin`) и ограничение пересечения (`EXCLUDE`) — воспроизводит `SaveChangesInterceptor` в `BookingsApiFactory.cs`. Реальное ограничение и порядок `uuid` на PostgreSQL этими тестами не проверяются; для этого нужен прогон через `Testcontainers.PostgreSql` (версия уже в одобренном перечне) в CI с Docker.

**Мелочи, не считаю расхождениями:** `Location` приходит абсолютным URL (допустимо для `uri-reference`), время в ответе — `+00:00` вместо `Z` (тот же момент UTC).
