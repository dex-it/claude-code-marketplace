CI для DPT-20 написан, но ни разу не запускался: сборки и сети здесь нет. Ничего не закоммичено.

**Изменённые файлы**
- `.github/workflows/ci.yml` (новый)
  - Запускается на каждый PR и на push в `main`. Новый push в ту же ветку PR отменяет предыдущий прогон.
  - Задания: `build` (сборка и аудит уязвимостей зависимостей), `contracts` (тесты категории `Contracts` на ubuntu и windows), `integration` (тесты с Postgres через Testcontainers, ubuntu), `format` (только отчёт), `license-check`, `image` и `deploy-stage`.
  - Зависимости ставятся через `dotnet restore --locked-mode`. Сборка с `TreatWarningsAsErrors` из `Directory.Build.props` служит статическим анализом.
  - Результаты тестов и покрытие (coverlet) сохраняются артефактами с `retention-days: 14`.
  - `dotnet format` не блокирует прогон: шаг идёт с `continue-on-error`, отчёт сохраняется артефактом.
  - `license-check` вызывает `ci-shared/.github/.github/workflows/license-check.yml@v2` после тестов.
  - `image` и `deploy-stage` идут только на `main`. Образ пушится в `registry.example.com/depot/api:<sha>` после всех проверок, затем запускается `deploy.yml` в `dex/depot-infra`.
- `.github/workflows/size-label.yml` (новый): метка `size/S`, `size/M` или `size/L`. Триггер `pull_request_target`, чтобы метка ставилась и на PR из форков. Код PR не выкачивается и не запускается, берутся только числа из события.
- `Directory.Build.props`: добавлен `RestorePackagesWithLockFile=true`, чтобы лок-файлы генерировались.

**Замечания и что нужно сделать до первого запуска**
1. **Лок-файлы.** В репозитории нет `packages.lock.json`, а сгенерировать их здесь нельзя. Пока их не закоммитили, `--locked-mode` упадёт. Запустите локально `dotnet restore` и закоммитьте файлы.
2. **Обязательные проверки для мержа.** Это настройка защиты ветки `main` на GitHub, из репозитория её не включить. Сделайте обязательными `build`, `contracts (ubuntu-latest)`, `contracts (windows-latest)`, `integration` и `license-check`. `format (report only)` в обязательные не добавляйте.
3. **Секрет `DEPOT_INFRA_TOKEN`.** Стандартный `GITHUB_TOKEN` не умеет запускать workflow в другом репозитории. Нужен токен с правом `actions:write` на `dex/depot-infra`, секрет `DEPOT_INFRA_TOKEN` в задаче не упомянут.
4. **Параметры `deploy.yml`.** Какие входные параметры принимает `deploy.yml`, неизвестно, поэтому деплой запускается без них (`--ref main`). Если ему нужен тег образа, его надо передать (`-f`), иначе деплой не узнает, какой образ выкатывать.
5. **Self-hosted раннеры `depot-linux` не использованы.** PR приходят из форков, а на раннере внутри сети компании выполнялся бы чужой код. Для Testcontainers там ещё и не гарантирован Docker. Если нужно, можно подключить их только для `push` в `main`.
6. **Пороги размера PR.** В задаче их нет, я взял по сумме добавленных и удалённых строк: S ≤ 50, M ≤ 250, L больше. Подправьте, если у команды другие.
7. **Аудит уязвимостей** смотрит на вывод `dotnet list package --vulnerable`, поэтому ему нужен доступ к NuGet-фиду. Это единственное задание, которое может упасть по причинам вне кода.
8. **Образ** тегируется только по SHA коммита, тега `latest` нет.
