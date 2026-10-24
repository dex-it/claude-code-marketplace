Я поправил три файла в рабочем дереве, ничего не коммитил. Ничего не запускал: сборки и сети нет, так что правки не проверены.

**Изменённые файлы**
- `.github/workflows/ci.yml`
- `.github/workflows/security.yml`
- `docs/hosting/branch-protection.json`

**Что исправлено в `ci.yml`**
- **Тесты:** фильтр `Category=Unit` не подходил ни одному тесту, потому что в репозитории только категории `Contracts` и `Integration`. Шаг «зелёный» ничего не запускал. Фильтр убран, идут все тесты. Интеграционным нужен Docker, он есть на `ubuntu-latest`.
- **Конфигурация тестов:** `dotnet test -c Debug --no-build` после сборки в Release падал бы или ничего не тестировал. Теперь `-c Release`.
- **`continue-on-error` на тестах** убран: упавшие тесты теперь валят job.
- **`|| true` на шаге analyzers** убран: предупреждения анализаторов теперь валят job.
- **Сборка:** `| tee build.log` скрывал код возврата `dotnet build`, потому что `pipefail` не был включён. Убрал `tee`, а вместе с ним и шаг cleanup, который чистил только `build.log`.
- **Формат:** `dotnet format` только правил файлы на агенте и всегда проходил. Теперь `--verify-no-changes`.
- **Шаг «lint changed files»** удалён. Он тоже не проверял, а только форматировал. Кроме того, при `fetch-depth` по умолчанию `origin/main...HEAD` недоступен. Проверка формата по всему проекту его заменяет.
- **Триггер `pull_request`:** убран фильтр `paths`. Если PR менял только `Directory.Packages.props`, `global.json`, Dockerfile или workflow, check `ci` не создавался. Обязательный check тогда повисал в ожидании, и PR либо нельзя было смержить, либо правило приходилось обходить.
- **Шаг coverage comment** оставил как есть: он справочный, `continue-on-error` там уместен.

**Что исправлено в `security.yml`**
- Аудит пакетов запускался только после пуша в `main`, то есть уже после попадания изменения. Добавил запуск на `pull_request`.
- `dotnet list package --vulnerable` всегда завершается с кодом 0. Теперь шаг падает, если в выводе есть «has the following vulnerable packages».

**Что исправлено в `branch-protection.json`**
- В обязательные checks добавлен `audit`.
- `enforce_admins` теперь `true`, иначе администраторы обходят все правила.
- Добавлен `dismiss_stale_reviews`: новый коммит после approve сбрасывает одобрение.

**Что нужно сделать вне репозитория**
- Администратор должен применить обновлённый `branch-protection.json` к `main` (`PUT /repos/dex/depot/branches/main/protection`). Экспорт сам ничего не включает. Заодно стоит сверить, что имена contexts `ci` и `audit` совпадают с тем, что реально показывает GitHub.
- Нужен Docker на раннере. На hosted `ubuntu-latest` он есть. Если раннеры будут self-hosted, его надо обеспечить.

**Замечания**
- Интеграционный тест `Receive_then_get_returns_quantity` пока пустышка: `Assert.Equal(OK, OK)`. Он всегда зелёный, и реальной проверки эндпоинта и Postgres нет. Это стоит вынести в отдельную задачу.
- Покрытие нигде не собирается, файла `coverage/summary.txt` не будет. Шаг комментария ничего не опубликует, пока в `dotnet test` не добавят `--collect:"XPlat Code Coverage"` и генерацию summary.
- `dex/coverage-comment@v1` не закреплён по SHA. Для комментария в PR ему к тому же понадобится `pull-requests: write`, а в job выданы только права на чтение. Сейчас из-за этого он, скорее всего, тихо падает под `continue-on-error`.
