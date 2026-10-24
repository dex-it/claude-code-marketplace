Я добавил два workflow и включил генерацию лок-файлов. Ничего не запускал и не коммитил: сборки и сети нет, YAML не проверялся.

**Изменённые файлы**
- `.github/workflows/ci.yml` (новый)
- `.github/workflows/size-label.yml` (новый)
- `Directory.Build.props`: добавлено `RestorePackagesWithLockFile=true`

**Что сделано**
- **Триггеры:** `ci.yml` запускается на каждый PR и на push в `main`.
- **Сборка и тесты (`test`):** шаги restore, build и test идут по очереди, build и test с `--no-restore` и `--no-build`. Restore идёт с `--locked-mode`. На ubuntu идут все тесты, а на windows только `Category=Contracts`. Интеграционные тесты на ubuntu используют Docker из раннера.
- **Артефакты:** результаты тестов (trx) и покрытие сохраняются с `retention-days: 14`.
- **Аудит зависимостей (`vulnerabilities`):** это отдельный блокирующий job. Он падает, если `dotnet list package --vulnerable --include-transitive` находит уязвимости. Нужен по минимуму гейтов из `ci-gates.md`.
- **Форматирование (`format`):** `dotnet format --verify-no-changes` с `continue-on-error`. Отчёт сохраняется артефактом, релиз не блокируется.
- **Лицензии (`license-check`):** вызывается как reusable workflow после `test`.
- **Образ и деплой (`image`):** выполняется только на push в `main`, после `test`, `vulnerabilities` и `license-check`. Образ уходит в `registry.example.com/depot/api:<sha>`, потом `gh workflow run deploy.yml --repo dex/depot-infra`.
- **Метка размера:** `size-label.yml` работает на `pull_request_target`, поэтому метка ставится и на PR из форков. Код PR не checkout-ится и не запускается, размер берётся из `additions + deletions` события.
- **Прочее:** права по умолчанию `contents: read`, у jobs есть таймауты, а предыдущие прогоны PR отменяются при новом push.

**Замечания**
1. **Лок-файлов в репозитории нет.** `restore --locked-mode` будет падать, пока не закоммичены `packages.lock.json`. Нужно один раз выполнить `dotnet restore` локально и закоммитить файлы.
2. **Actions закреплены тегами, а не SHA.** Без сети я не смог получить SHA и выдумывать их не стал. Рядом с каждым `uses` стоит `# TODO: закрепить SHA`. Reusable workflow `ci-shared/...@v2` тоже закреплён тегом.
3. **Нужна настройка вне репозитория.** Проверки `test (ubuntu)`, `test (windows-contracts)`, `vulnerabilities` и `license-check` надо объявить required в защите ветки `main`. `format` в required не включать.
4. **Секрет для деплоя в `ci.yml` придуман мной.** Для запуска workflow в другом репозитории `GITHUB_TOKEN` не подходит. Я использовал секрет `DEPOT_INFRA_DISPATCH_TOKEN` (PAT или токен GitHub App с правом actions:write на `dex/depot-infra`). Его нужно завести.
5. **В деплой не передаётся тег образа.** Входы `deploy.yml` в задаче не описаны. Скорее всего, ему нужен тег `${{ github.sha }}`, и это надо согласовать.
6. **Self-hosted раннеры `depot-linux` не использованы.** PR приходят из форков, и запуск чужого кода на внутренних раннерах в сети компании небезопасен. Если нужны быстрые сборки, их можно гонять только для push в `main` или для PR не из форков.
7. **Пороги меток размера выбраны мной:** S до 50 изменённых строк, M до 250, L больше. Подтвердите их или назовите свои.
8. **`vulnerabilities` и `format` делают restore заново.** Это небольшая избыточность, зато job'ы независимы.
9. **Теста с Testcontainers по сути нет.** `StockEndpointTests` — заглушка, которая Postgres не поднимает.
