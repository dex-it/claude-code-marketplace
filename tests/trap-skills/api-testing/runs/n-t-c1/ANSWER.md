Тестовый проект готов, `dotnet test` зелёный: 99 прошли, 3 пропущены (скипы — три найденных расхождения). Ничего не закоммичено.

## Изменённые файлы

- `Bookings.sln` — добавлен проект тестов.
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — xunit, Microsoft.NET.Test.Sdk, Mvc.Testing, Testcontainers.PostgreSql; все версии из `Directory.Packages.props`.
- `tests/Bookings.Api.Tests/ApiFixture.cs` — один PostgreSQL (`postgres:16-alpine`, образ уже есть локально) и одно приложение на все тесты. Каждый тест работает в своей комнате, поэтому тесты не мешают друг другу.
- `tests/Bookings.Api.Tests/ApiResponse.cs`, `ApiCollection.cs` — вспомогательные типы.
- `tests/Bookings.Api.Tests/RoomsTests.cs` — список комнат, карточка и устаревшие брони комнаты.
- `tests/Bookings.Api.Tests/BookingCreateTests.cs` — создание брони.
- `tests/Bookings.Api.Tests/BookingReadTests.cs` — получение брони и лента с курсором.
- `tests/Bookings.Api.Tests/BookingChangeTests.cs` — перенос и отмена.
- `tests/Bookings.Api.Tests/AuthTests.cs` — 401 `unauthorized` на всех 8 операциях без ключа и с неизвестным ключом.

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Добавлен проект `tests/Bookings.Api.Tests`. Тесты поднимают API через `WebApplicationFactory` на реальном PostgreSQL в Testcontainers: ограничение на пересечение броней живёт в БД, на InMemory или Sqlite его не проверить. Нужен локальный Docker.

Покрытие: все операции `/api/v1/rooms...` и `/api/v1/bookings...`, успешные ответы и ошибки 400/401/403/404/409 с `code`.
- Границы FR-05 и FR-08.
- Пересечения, FR-10 (владелец и администратор) и FR-11.
- Version-conflict и перенос отменённой брони.
- Курсор без пропусков и дублей.
- Периоды `from`/`to`.

Расхождения реализации с контрактом (по одному на строку; три теста помечены `Skip` со ссылкой на BKG-31):
- `GET /api/v1/bookings?roomId=` — контракт: `roomId` ≤ 64 символов, нарушение — 400; сервис: 200 с пустой страницей при `roomId` из 65 символов.
- `PATCH /api/v1/bookings/{bookingId}` — контракт: `version` обязателен, без него 400; сервис: подставляет 0 и отвечает 409 `version-conflict`.
- `GET|PATCH|DELETE /api/v1/bookings/{bookingId}` при `bookingId`, не являющемся uuid, — контракт: 404 `application/problem+json` с обязательным `code` (`booking-not-found`); сервис: 404 problem+json без `code`.

Прочее:
- В `RoomsController` есть `POST /api/v1/internal/rooms/reindex` (только admin), которого нет в `openapi.yaml`. Тестами не покрыт, на ревью: убрать из сервиса или описать в контракте.
- Намеренно не считал расхождением:
  - `Location` приходит абсолютным URL — допустимо для `uri-reference`.
  - Время в ответах с `+00:00` вместо `Z` — тоже валидный date-time в UTC.

Скипы снимаются после исправления сервиса либо контракта.
