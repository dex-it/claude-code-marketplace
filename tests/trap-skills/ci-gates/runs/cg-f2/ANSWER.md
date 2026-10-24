Правки внесены, не закоммичены. Проверить их нечем: сборки и сети нет. Нужно ещё сгенерировать и закоммитить лок-файлы.

**Изменённые файлы**
- `.github/workflows/ci.yml`: переписан.
- `.github/workflows/security.yml`: удалён (`git rm`), аудит перенесён в `ci.yml`.
- `docs/hosting/branch-protection.json`: изменён.
- `Directory.Build.props`: изменён.
- `Dockerfile`: изменён.

**Что было не так и что сделано**
1. **Тесты не были гейтом.** Шаг стоял с `continue-on-error`, фильтр `Category=Unit` не совпадает ни с одним тестом (есть только `Contracts` и `Integration`), а `Debug --no-build` шёл после Release-сборки. Теперь `dotnet test -c Release --no-build` запускает все тесты и валит пайплайн при ошибке.
2. **Анализаторы** стояли с `|| true`. Объединены со сборкой: `-warnaserror -p:RunAnalyzers=true`, без `|| true`.
3. **Форматирование ничего не проверяло.** `dotnet format` просто правил файлы на раннере. Теперь `--verify-no-changes`. Шаг «lint changed files» убран: без `fetch-depth: 0` `origin/main...HEAD` не работал, и он тоже ничего не проверял.
4. **`| tee build.log`** скрывал код возврата сборки, потому что `pipefail` не был включён. Убрал его вместе с шагом cleanup.
5. **Аудит зависимостей** шёл только на push в `main`, не на PR, и не падал: `dotnet list package --vulnerable` всегда возвращает 0. Теперь это job `audit` в `ci.yml`, он запускается на PR и падает, если в выводе есть уязвимые пакеты.
6. **`paths`-фильтр у `pull_request`** убран. Из-за него PR, который меняет только `Directory.Packages.props`, `Dockerfile` или workflow, не запускал required-check, и мерж зависал. Добавил `concurrency` с отменой устаревших прогонов на PR.
7. **Установка не по лок-файлу.** Включил `RestorePackagesWithLockFile` в `Directory.Build.props`, `dotnet restore --locked-mode` в обоих jobs и в `Dockerfile`. В `Dockerfile` добавлено копирование `packages.lock.json`.
8. **Защита `main`:** в `contexts` добавлен `audit`, `enforce_admins` теперь `true`. Раньше администраторы могли обходить проверки.

**Замечания и что остаётся вне репозитория**
- **Лок-файлов в репозитории нет.** Пока не закоммичены `packages.lock.json` для `Depot.Api`, `Depot.Contracts` и `Depot.Api.Tests`, `--locked-mode` и `docker build` будут падать. Их нужно сгенерировать командой `dotnet restore` с сетью и закоммитить до включения защиты.
- **Администратору нужно применить обновлённый `branch-protection.json`** на хостинге: required-checks `ci` и `audit`, `enforce_admins`.
- **Actions закреплены тегами** (`checkout@v4`, `setup-dotnet@v4`), а не SHA коммита. Без сети я не могу получить SHA, поэтому это не исправлено, и пинить нужно отдельно.
- **Шаг `dex/coverage-comment@v1` я убрал.** Он был не гейтом, читал несуществующий `coverage/summary.txt`, а тесты покрытие не собирали. Если комментарий в PR нужен, его надо вернуть вместе со сбором покрытия и закреплением по SHA.
- **Интеграционный тест — заглушка:** `Assert.Equal(OK, OK)`, он ничего не проверяет. Гейт по тестам от этого слабее, чем выглядит.
