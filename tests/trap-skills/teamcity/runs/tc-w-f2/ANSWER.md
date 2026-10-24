Конфигурацию TeamCity я написал, но не компилировал и не запускал: сборок, сети и Maven нет. Имена API Kotlin DSL (например `failOnMetricChange`, `pullRequests`) проверьте компиляцией на сервере. Ничего не закоммичено.

**Новые файлы**
- `.teamcity/settings.kts` — проект `Depot`, сервер 2024.12. Вызывает общую функцию со своим `ServiceSpec`.
- `.teamcity/DotnetServicePipeline.kt` — вся цепочка в функции `dotnetServicePipeline(ServiceSpec)`. Остальные девять сервисов подключают её со своим `ServiceSpec` и не копируют конфигурацию.
- `.teamcity/pom.xml` — стандартный pom для DSL из нескольких файлов. Подставьте реальный URL сервера вместо `teamcity.example.com`.

**Цепочка:** Build, затем Static analysis and audit, Unit tests, Integration tests, Image and push, Deploy stage, Deploy prod.
- **Build:** `restore` и `build`; результат уходит артефактом `workspace.zip`.
- **Тесты:** берут этот артефакт и идут с `--no-restore --no-build`. Unit — фильтр `Category=Contracts`, integration — `Category=Integration`.
- **Prod:** без триггера, запускается кнопкой Run после успешного stage.
- **Деплой:** образ и `deploy-values.yaml` берутся из Image той же цепочки, по `%dep.…build.number%` и artifact dependency.
- **Параметры:** `db.password`, `registry.password` и `deploy.token` лежат в проекте как password-параметры с пустым значением. Задайте их в хранилище секретов TeamCity; в скрипты они попадают через `env.*`.

**Защита от происшествий**
- Тест-конфигурации падают, если прошло меньше одного теста, если в логе есть «No test matches the given testcase filter» или «No test is available», и при `OutOfMemoryException` в логе.
- Конфигурация Static analysis and audit: `dotnet format --verify-no-changes` и `dotnet list package --vulnerable`, который падает по тексту «has the following vulnerable packages». Это закрывает обязательный минимум из `ci-gates` (типы проверяет сборка с `TreatWarningsAsErrors`).

**Триггеры**
- VCS-триггер на `main` стоит на Deploy stage и запускает всю цепочку.
- PR, в том числе из форков, запускают только Build, Analyze и оба набора тестов.
- Образ, push и деплой из PR недоступны: у Deploy stage фильтр `+:main`, а у Image триггера нет.

**Замечания к задаче**
1. **`deploy-values.yaml`.** Его нет в репозитории и в задаче не описан формат. Я генерирую минимальный файл с `image.repository` и `image.tag` на шаге Image; формат придуман мной, сверьте с реальным чартом.
2. **Деплой.** Инструмент не указан. Я взял `helm upgrade --install … --kube-token`. Параметры `deploy.chart`, `registry.host` и `registry.user` пустые, их надо заполнить.
3. **Лок-файлов нет.** В репозитории нет `packages.lock.json`, так что `restore --locked-mode` включить нельзя: он упадёт. Пункт «установка по лок-файлу» из `ci-gates` не выполнен. Нужно сгенерировать и закоммитить лок-файлы, потом добавить `--locked-mode` в `restore` и в `Dockerfile`.
4. **Обязательность проверок для мержа.** Это настройка защиты ветки в GitHub, из DSL её не задать. Я не добавлял commit status publisher: ему нужен токен.
5. **Секреты и форки.** PR из форков получают доступ к `db.password` в integration-тестах. Используйте для него одноразовое значение, не боевое. Реестр и `deploy.token` из PR недоступны.
6. **VCS root и PR.** Я использую `DslContext.settingsRoot`. В его branch spec должен быть `+:refs/pull/*/head`, иначе PR-ветки не появятся. Это настраивается в UI.
7. **`dotnet publish`.** Отдельным шагом его нет: образ собирается `Dockerfile`, который публикует исходники заново. В образ идёт не тот бинарник, что прошёл тесты.
8. **Артефакт `workspace.zip`.** Он включает `obj`, а там абсолютные пути. Тестам с `--no-build` это обычно не мешает, но проверьте на первом прогоне.
9. **Общий код.** Для десяти сервисов `.kt` надо вынести в общий репозиторий или библиотеку DSL. Пока он лежит рядом с Depot, как образец.
