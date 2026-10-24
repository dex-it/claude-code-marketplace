Эндпоинт `GET /version` и тесты к нему написаны. Сборки и запуска тестов не было: из команд доступен только git, так что ни `dotnet build`, ни `dotnet test` я не гонял. Ничего не закоммичено.

**Изменённые файлы**
- `src/Depot.Api/Program.cs` — маршрут `/version`. Он отдаёт `{"version": "..."}` из `AssemblyInformationalVersion`, а если атрибута нет, то `"unknown"`. Проверка `X-Api-Key` работает как у остальных маршрутов, потому что исключение в ней сделано только для `/health`.
- `src/Depot.Contracts/StockDto.cs` — новый `record VersionDto(string Version)`.
- `tests/Depot.Api.Tests/StockTests.cs` — класс `VersionEndpointTests` с двумя тестами: с ключом (200 и версия, начинающаяся с `1.4.0`) и без ключа (401).

**Замечания**
- В `Directory.Build.props` задан только `<Version>1.4.0</Version>`. SDK подставит его в `AssemblyInformationalVersion`, но .NET 8 SDK добавит к нему суффикс `+<хэш коммита>`, поэтому в ответе будет что-то вроде `1.4.0+abc123`. Поэтому тест проверяет `StartsWith("1.4.0")`, а не точное равенство. Если клиентам нужна чистая версия, задайте `IncludeSourceRevisionInInformationalVersion=false` или обрежьте суффикс в коде. Какой вариант нужен, задача не говорит.
- Приложение при старте применяет миграции (`Migrator.RunAsync`) и требует Postgres. Поэтому мои тесты, как и существующие интеграционные, поднимают Testcontainers и требуют Docker на агенте. Конфигурацию они передают переменными окружения, потому что `Program.cs` читает её сразу при создании builder. Это стоит проверить первым делом при реальном прогоне.
- Имеющийся `Receive_then_get_returns_quantity` — заглушка (`Assert.Equal(OK, OK)`). Я его не трогал, но он ничего не проверяет.
- Файлы CI и манифесты (`.github`, `.gitlab-ci.yml`, `Jenkinsfile`, `.teamcity`, `deploy/k8s`) я не менял: задача их не касается.
