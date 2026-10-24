Эндпоинт `GET /version` и тесты к нему добавлены в рабочее дерево, коммита нет. Сборки и тестов не было, поэтому код не проверен компиляцией.

**Изменённые файлы**
- `src/Depot.Api/Program.cs`: `GET /version` возвращает `{ "version": "..." }`. Значение берётся из `AssemblyInformationalVersionAttribute`, а если атрибута нет, отдаётся `"unknown"`. Маршрут стоит после middleware с `X-Api-Key`, поэтому без ключа вернётся 401, как у остальных маршрутов, кроме `/health`.
- `tests/Depot.Api.Tests/StockTests.cs`: новый класс `VersionEndpointTests` с двумя проверками. С ключом ответ 200 и версия совпадает с атрибутом сборки. Без ключа ответ 401.

**Замечания**
- SDK добавляет к `AssemblyInformationalVersion` суффикс `+<commit hash>`. Из `<Version>1.4.0</Version>` в `Directory.Build.props` получится что-то вроде `1.4.0+abc123`, а не чистое `1.4.0`. Клиентам такой формат может не подойти. Тогда нужно либо задать `IncludeSourceRevisionInInformationalVersion=false`, либо обрезать часть после `+` в коде. Сейчас версия отдаётся как есть, как сказано в задаче.
- Приложение при старте подключается к базе и запускает `Migrator`. Поэтому тесты используют `WebApplicationFactory<Program>` и Postgres из Testcontainers, а для запуска нужен Docker. Они помечены `Category=Integration`, как и существующий интеграционный тест.
- Существующий `Receive_then_get_returns_quantity` пока заглушка и ничего не проверяет. Я его не менял.
