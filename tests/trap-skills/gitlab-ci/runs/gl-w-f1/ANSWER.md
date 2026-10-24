Я добавил `.gitlab-ci.yml` в корень репозитория. Это единственный изменённый файл, ничего не закоммичено. Сам пайплайн не запускался и YAML не проверялся: сети и сборки нет.

**Что в пайплайне**
- **Запуск:** на MR и на ветках `main` и `develop`.
- **Сборка и тесты:** стадии `build` и `test` (restore, build, test) идут на общих раннерах. Интеграционным тестам поднимается `postgres:16` с алиасом `postgres`. `ConnectionStrings__Default` задана со строкой `Host=postgres`.
- **Гейты:** добавил `lint` (`dotnet format --verify-no-changes`) и `dependency-audit` (по выводу `dotnet list package --vulnerable --include-transitive`, потому что команда сама всегда выходит с 0). Предупреждения компилятора и так валят сборку из-за `TreatWarningsAsErrors`.
- **Покрытие:** `reportgenerator` собирает `TextSummary` и Cobertura, `Summary.txt` печатается в лог, `coverage:` разбирает строку `Line coverage: N%`. Отчёт Cobertura подключён к MR.
- **Образ:** джоба `image` собирает образ docker-in-docker и пушит `$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA`, только на `main`.
- **Деплой:** `deploy-stage` идёт автоматически после образа, `deploy-prod` — после stage. Обе джобы на раннере с тегом `depot-deploy`.
- **Лог деплоя:** в лог идут окружение, namespace, deployment, образ и коммит, затем статус раската и `kubectl get deployment`. `env` и `set -x` не используются, чтобы не вывести `KUBECONFIG_B64`.
- **Остальное:** на всех джобах кроме деплоя стоит `interruptible: true`, а у деплоя `false`. Для stage и prod заведены `resource_group` и `environment`. NuGet-кэш привязан к `Directory.Packages.props`, артефакты с `expire_in`.

**Замечания к задаче**
1. **Prod вручную.** В задаче не сказано, автоматический ли prod, поэтому я сделал `when: manual` после stage. Если нужен автоматический, уберите эту строку.
2. **Нет лок-файлов.** В репозитории нет `packages.lock.json`, поэтому restore идёт без `--locked-mode`. Чтобы включить строгий режим, нужно в `Directory.Build.props` добавить `RestorePackagesWithLockFile`, сгенерировать и закоммитить лок-файлы, а затем добавить `--locked-mode` в restore. Версии в `Directory.Packages.props` зафиксированы, а транзитивные зависимости — нет.
3. **Защита ветки.** Required checks для мержа (`build`, `test`, `lint`, `dependency-audit`) настраиваются в GitLab, а не в YAML. Их нужно включить в настройках проекта: в защите ветки и в разделе Merge requests, опция «Pipelines must succeed».
4. **Testcontainers и сервис Postgres.** README говорит, что интеграционные тесты поднимают Postgres через Testcontainers, а в задаче требуется service-контейнер. Сейчас тесты — заглушки и базу не используют. Настоящие интеграционные тесты на shared docker executor без доступа к docker-сокету упадут. Их стоит перевести на `ConnectionStrings__Default` или выдать раннеру доступ к Docker.
5. **`DB_MIGRATION_PASSWORD`.** В пайплайне переменная не используется. Миграции выполняются самим приложением при старте (`Migrator`), а пароль БД уже лежит в настройках приложения в кластере. Если нужен отдельный шаг миграций, его надо описать отдельно.
6. **`depot-worker`.** Он работает на том же образе (`runbook.md`), а деплой обновляет только `depot-api`. Воркер останется на старой версии, пока его не добавят в деплой.
7. **MR из форков.** Protected-переменные в них недоступны, и это нормально: `image` и деплой идут только на `main`. Для shared-раннеров с dind нужен privileged-режим.
8. **Версии.** Образы (`sdk:8.0.404`, `docker:27`, `alpine/k8s:1.30.4`) и `reportgenerator 5.3.11` я выбрал по памяти, сверить их в вашем реестре не мог.
