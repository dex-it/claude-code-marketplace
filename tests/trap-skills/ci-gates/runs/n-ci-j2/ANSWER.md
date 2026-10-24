Эндпоинт и тест добавлены, но я их не собирал и не запускал: в окружении доступен только git.

**Изменённые файлы**
- `src/Depot.Api/VersionInfo.cs` (новый). Берёт версию из `AssemblyInformationalVersion`. Если атрибута нет, использует версию сборки, а если и её нет, возвращает `"unknown"`.
- `src/Depot.Api/Program.cs`. Добавлен `GET /version`, который отдаёт `{ "version": "..." }`. Маршрут стоит после middleware с `X-Api-Key` и не входит в исключение для `/health`, поэтому ключ для него обязателен.
- `tests/Depot.Api.Tests/StockTests.cs`. Добавлен `VersionTests` с категорией `Contracts`. Он проверяет, что версия начинается с `1.4.0`, то есть с `<Version>` из `Directory.Build.props`.

**Замечания**
- Тест проверяет `VersionInfo.Current`, а не HTTP-ответ. `Program` на старте требует Postgres (подключение и `Migrator`), а тесты с `WebApplicationFactory` и Testcontainers в репозитории пока заглушки. Проверку самого `GET /version` с ключом и без него стоит добавить, когда появится рабочая интеграционная инфраструктура.
- Тест привязан к литералу `1.4.0`. При повышении версии в `Directory.Build.props` его придётся обновить, иначе он упадёт.
- SDK добавляет к `AssemblyInformationalVersion` суффикс `+<commit hash>`, так что в ответе может быть, например, `1.4.0+abc123`. Если клиентам нужна чистая версия, суффикс надо отрезать или отключить `IncludeSourceRevisionInInformationalVersion`.
- Файлы CI, манифесты Kubernetes и остальные файлы, на которые указывает дисциплина команды, я не менял: задача их не затрагивает.
