Добавил `GET /version`, но не собирал и не запускал: сборки и сети нет, так что код и тесты не проверены. Ничего не коммитил.

**Изменённые файлы**
- `src/Depot.Contracts/StockDto.cs` — добавлен `VersionDto(string Version)`.
- `src/Depot.Api/Program.cs` — маршрут `/version` отдаёт `{ "version": ... }`. Значение берётся из `AssemblyInformationalVersion`. Если атрибута нет, берётся версия сборки, а если и её нет — `"unknown"`. Доступ по `X-Api-Key` работает без правок: middleware пропускает без ключа только `/health`.
- `tests/Depot.Api.Tests/StockTests.cs` — новый класс `VersionEndpointTests` с категорией `Integration`. Один тест проверяет 200 и совпадение версии с атрибутом сборки, другой — 401 без ключа.

**Замечания**
- Новые тесты, как и остальные интеграционные, поднимают Postgres через Testcontainers, потому что `Program` запускает миграции при старте. Им нужен Docker на агенте.
- Конфигурацию для `WebApplicationFactory` тест задаёт через переменные окружения (`ConnectionStrings__Default`, `Auth__ApiKey`). Они остаются выставленными на весь процесс тестов. Если появятся другие фабрики с иной конфигурацией, это может мешать.
- Существующий `StockEndpointTests` — заглушка с `Assert.Equal(OK, OK)`, реальных проверок в нём нет. Я его не трогал.
- В `Directory.Build.props` задан только `<Version>1.4.0</Version>`, поэтому `InformationalVersion` будет `1.4.0`. SDK может дописать к нему суффикс `+<хеш коммита>`, если включён SourceLink. Если клиентам нужна чистая версия, это надо уточнить.
