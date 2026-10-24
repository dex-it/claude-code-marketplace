Эндпоинт `GET /version` добавлен, но сборки и тестов я не запускал: по условиям доступен только git. Код не компилировался, тесты не выполнялись, и не проверено, что `UseSetting` подхватывается при старте приложения.

**Изменённые файлы**
- `src/Depot.Api/AppVersion.cs` (новый): `AppVersion.Current` читает `AssemblyInformationalVersion` из сборки. Если атрибута нет, вернёт `"unknown"`.
- `src/Depot.Api/Program.cs`: добавлен `GET /version`, ответ `{ "version": "..." }`. Проверка `X-Api-Key` уже стоит в общем middleware для всех путей, кроме `/health`, поэтому для `/version` ключ требуется без доп. кода.
- `tests/Depot.Api.Tests/StockTests.cs`:
  - Юнит-тест категории `Contracts`: версия начинается с `1.4.0`.
  - Два интеграционных теста категории `Integration`: ответ 200 с версией при верном ключе и 401 без ключа. Они поднимают Postgres через Testcontainers, поэтому нужен Docker.

**Замечания**
- `AssemblyInformationalVersion` в .NET SDK 8 по умолчанию выглядит как `1.4.0+<хэш коммита>`. Эндпоинт отдаёт строку как есть, поэтому в ответе будет хэш. Если клиентам нужен чистый `1.4.0`, это надо уточнить: тогда можно отрезать часть после `+` или задать `IncludeSourceRevisionInInformationalVersion=false` в `Directory.Build.props`.
- Существующий «интеграционный» тест `Receive_then_get_returns_quantity` пустой: он сравнивает `OK` с `OK` и ничего не проверяет.
