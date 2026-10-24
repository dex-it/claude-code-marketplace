Тестовый проект готов; `dotnet test tests/Bookings.Api.Tests` зелёный: 80 прошли, 3 пропущены (расхождения ниже). Ничего не закоммичено.

## Изменённые файлы

- `Bookings.sln` — добавлен проект `tests/Bookings.Api.Tests` (папка решения `tests`).
- `tests/Bookings.Api.Tests/Bookings.Api.Tests.csproj` — новый; пакеты только из `Directory.Packages.props` (Mvc.Testing, Test.Sdk, Testcontainers.PostgreSql, xunit, xunit.runner.visualstudio).
- `tests/Bookings.Api.Tests/ApiFixture.cs` — `WebApplicationFactory<Program>` поверх PostgreSQL в Testcontainers (образ `postgres:16`, он есть локально) и три ключа: участники alice и bob, администратор.
- `tests/Bookings.Api.Tests/TestSupport.cs` — выдача непересекающихся окон времени, помощники запросов, проверки формы ответов по схемам контракта.
- `tests/Bookings.Api.Tests/RoomsTests.cs` — операции комнат, включая устаревшую `/rooms/{roomId}/bookings`.
- `tests/Bookings.Api.Tests/BookingsTests.cs` — лента с курсором, создание, получение, перенос, отмена.

Для запуска нужен Docker. Тесты используют образ `postgres:16`, а при завершении работы Testcontainers чистит за собой через образ Ryuk. Чужой контейнер `pg-sup1545` я не трогал.

## Описание MR

**BKG-31: интеграционные тесты API по контракту 1.2.0**

Новый проект `tests/Bookings.Api.Tests`: тесты идут через настоящий HTTP-стек и PostgreSQL, потому что пересечение броней проверяет ограничение `btree_gist` в БД, а не код. Покрыты 83 теста по операциям комнат и броней:
- успешные ответы, ограничения FR-05/08/09/10/11, права владельца и администратора;
- ошибки 400/401/403/404/409 с проверкой `code` из перечня контракта;
- курсорный обход ленты без пропусков и повторов.

Расхождения реализации с контрактом (по одному на строку; соответствующие тесты помечены `Skip` с причиной и снимаются после исправления):

- `createBooking` (POST /api/v1/bookings): `roomId` длиннее 64 символов — контракт ждёт 400 `ValidationProblem` (maxLength 64), сервис отвечает 404 `room-not-found`.
- `rescheduleBooking` (PATCH /api/v1/bookings/{bookingId}): тело без обязательного `version` — контракт ждёт 400, сервис отвечает 409 `version-conflict` (отсутствующее поле читается как 0).
- `getBooking` (GET /api/v1/bookings/{bookingId}), `bookingId` не uuid: контракт описывает 404 с `Problem`, где `code` обязателен, а сервис отвечает 404 без `code`. Контракт прямо не говорит, что должен возвращать запрос с невалидным uuid, поэтому это расхождение спорное, на решение авторов контракта.

Наблюдения вне контракта, тестами не закрыты:
- `POST /api/v1/internal/rooms/reindex` есть в коде, но отсутствует в `api/openapi.yaml`.
- Для участника без прав сервис отвечает 403 с `code: forbidden`, которого нет в перечне `Problem.code`.

Контракт и поведение сервиса в этом MR не менялись.

Заметка по дисциплине команды: проверку «операция без примера ошибочного ответа» из `api-spec-quality` я здесь не делал — задача про поведение, а не про качество спеки. При этом ни у одной операции в `openapi.yaml` нет примера ответа с ошибкой, и это стоит поднять отдельно.
