`GET /version` добавлен, но я ничего не собирал и не запускал, потому что доступен только git. Код и тесты не проверены компиляцией.

**Изменённые файлы**
- `src/Depot.Api/Program.cs` — маршрут `GET /version` отдаёт `{ "version": "<AssemblyInformationalVersion>" }`. Если атрибута нет, вернётся `"unknown"`. Доступ по `X-Api-Key` работает без доработок: middleware пропускает без ключа только `/health`.
- `tests/Depot.Api.Tests/StockTests.cs` — новый класс `VersionEndpointTests` с двумя тестами:
  - с ключом приходит 200 и версия, равная `AssemblyInformationalVersion` (она начинается с `1.4.0`);
  - без ключа приходит 401.

Тесты помечены `Category=Integration`.

**Замечания**
- Приложение при старте подключается к БД и применяет миграции. Поэтому тесты поднимают Postgres через Testcontainers, и для них нужен Docker на агенте. Существующий `StockEndpointTests` — заглушка и ничего не проверяет.
- .NET SDK дописывает к `AssemblyInformationalVersion` суффикс `+<sha коммита>`, поэтому `/version` вернёт что-то вроде `1.4.0+abc123`. Если клиентам нужна чистая `1.4.0`, укажите это в задаче: тогда суффикс нужно отключить через `IncludeSourceRevisionInInformationalVersion=false` или обрезать в коде.
- Файлы CI, манифесты и пайплайны я не менял. Тесты фильтров по категориям не используют, так что все пайплайны, включая `dotnet test`, их запустят.
