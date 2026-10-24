Я поправил CI и экспорт защиты `main`. Ничего не запускал и не коммитил: сборки и сети нет, так что правки не проверены.

**Блокер до включения защиты.** В репозитории нет `packages.lock.json`. Пока их не закоммитят, `dotnet restore --locked-mode` в обоих workflow будет падать. Нужно выполнить локально `dotnet restore --force-evaluate` и закоммитить сгенерированные `packages.lock.json` для всех проектов (`src/Depot.Api`, `src/Depot.Contracts`, `tests/Depot.Api.Tests`).

**Изменённые файлы**

- `.github/workflows/ci.yml`
  - **Фильтр `paths` убран.** Он был у `pull_request` на `src/**` и `tests/**`. PR, который трогает только `Directory.Packages.props`, `Dockerfile` или сам workflow, не запускал `ci`, и обязательная проверка висела бы вечно.
  - **Установка по лок-файлу.** `dotnet restore` теперь идёт с `--locked-mode`.
  - **Сборка и анализаторы.** Они объединены в один шаг с `-warnaserror -p:RunAnalyzers=true`. Раньше анализаторы шли с `|| true`, а `build` с `| tee` скрывал код возврата сборки.
  - **Форматирование.** Был `dotnet format` без проверки, он просто правил файлы на агенте. Теперь `--verify-no-changes`.
  - **Шаг «lint changed files».** Я его удалил: он тоже ничего не проверял и опирался на `origin/main` при неглубоком checkout.
  - **Тесты.** Тесты шли в Debug с `--no-build` после Release-сборки, то есть собранного Debug не было. Фильтр `Category=Unit` не подходил ни одному тесту (есть только `Contracts` и `Integration`), так что гонялось 0 тестов. И стоял `continue-on-error`. Теперь Release, без фильтра и без `continue-on-error`.
  - **Шаг `cleanup`** удалён: он был бесполезен, а `build.log` больше не создаётся.
  - **Комментарий с покрытием** оставлен с `continue-on-error`: это отчёт, а не гейт.
- `.github/workflows/security.yml`
  - **Аудит на PR.** Он шёл только на push в `main`, то есть после мержа. Добавлен `pull_request`.
  - **Падение при уязвимостях.** `dotnet list package --vulnerable` всегда завершается с кодом 0. Теперь шаг падает, если в отчёте есть «has the following vulnerable packages».
  - **Установка по лок-файлу.** Добавлен `restore --locked-mode`.
- `Directory.Build.props`: добавлен `RestorePackagesWithLockFile=true`, чтобы лок-файлы вели все проекты.
- `docs/hosting/branch-protection.json`
  - **Обязательные проверки.** В `contexts` добавлен `audit`: раньше обязательным был только `ci`.
  - **Админы.** `enforce_admins` теперь `true`, иначе админы обходят защиту.

**Что нужно сделать вне репозитория**

- Администратор должен применить обновлённый `branch-protection.json` к настройкам `main` на GitHub.
- Проверить, что имена проверок на хостинге совпадают с `ci` и `audit`. После первого прогона в GitHub они могут отображаться иначе, например `ci / ci`.
- Убедиться, что Docker есть на раннерах. Он нужен интеграционным тестам с Testcontainers.

**Замечания**

- Тест `Receive_then_get_returns_quantity` пустой: он проверяет `OK == OK` и ничего не проверяет. Гейт «тесты» по нему формально зелёный, настоящего интеграционного покрытия пока нет.
- Шаг покрытия ссылается на `coverage/summary.txt`, который ничего не создаёт. Комментарий в PR не появится, пока нет генерации отчёта.
