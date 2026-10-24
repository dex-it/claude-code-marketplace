Интеграционные тесты API по контракту 1.2.0 написаны; `dotnet test` зелёный: 74 прошли, 2 пропущены (по расхождениям ниже). Ничего не закоммичено.

## Изменённые файлы
- `Bookings.sln` — добавлен тестовый проект.
- `tests/Bookings.Api.IntegrationTests/Bookings.Api.IntegrationTests.csproj` — новый; пакеты только из `Directory.Packages.props`.
- `tests/Bookings.Api.IntegrationTests/BookingsApiFactory.cs` — сервис на PostgreSQL 16 через Testcontainers (локальный образ `postgres:16-alpine`); ключи alice, bob и admin.
- `tests/Bookings.Api.IntegrationTests/TestSupport.cs` — слоты времени, помощники вызовов API, проверки схем и ошибок по контракту.
- `tests/Bookings.Api.IntegrationTests/RoomsApiTests.cs` — `listRooms`, `getRoom`, `listRoomBookings`.
- `tests/Bookings.Api.IntegrationTests/BookingsApiTests.cs` — `listBookings`, `createBooking`, `getBooking`, `rescheduleBooking`, `cancelBooking`.

Docker нужен для запуска тестов, потому что запрет пересечений броней держит ограничение PostgreSQL.

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Тестовый проект `Bookings.Api.IntegrationTests` (xUnit, `WebApplicationFactory` и PostgreSQL в Testcontainers). Покрыты все операции комнат и броней, включая постраничный вывод курсором и 401 на каждой операции. Проверяются:
- успешные ответы;
- ответы ошибок 400, 401, 403, 404, 409 с проверкой `code`;
- границы FR-05, FR-08, FR-09 и FR-10;
- идемпотентность повторной отмены (FR-11).

**Расхождения реализации с контрактом** (тесты на них помечены `Skip`; после исправления снять `Skip`):
1. `GET`/`PATCH`/`DELETE /api/v1/bookings/{bookingId}` с id не uuid: контракт ждёт 404 `application/problem+json` с `code: booking-not-found`, сервис отвечает 404 без `code`, потому что запрос не доходит до контроллера из-за ограничения `{id:guid}`.
2. `PATCH /api/v1/bookings/{bookingId}` без поля `version`: контракт (`version` обязателен) ждёт 400 с `errors`, сервис отвечает 409 `version-conflict`, потому что `uint` без значения становится 0.

**Что не считал расхождением:**
- Моменты времени сервис отдаёт как `+00:00`, а не `Z`; это валидный date-time в UTC.
- `Location` при создании абсолютный (`http://host/api/v1/bookings/{id}`); контракт показывает путь, но допускает `uri-reference`.
- Операция `POST /api/v1/internal/rooms/reindex` есть в коде, но не описана в контракте; не тестировалась. Администраторская, но её отсутствие в `openapi.yaml` стоит обсудить отдельно.

**Ограничения:** тесты используют общую БД и разводят слоты времени, поэтому лежат в одной xUnit-коллекции и не должны запускаться против общей БД параллельно с другими потребителями.
