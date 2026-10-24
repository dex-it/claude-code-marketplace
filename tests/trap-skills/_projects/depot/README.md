# Мини-проект Depot: вход наборов группы 4.4 (контейнеры и CI)

Сервис складского учёта на ASP.NET Core 8 (`net8.0`, minimal API, Npgsql 8.0.4, Central Package Management, без
`packages.lock.json`), Dockerfile, манифесты Kubernetes и пайплайны по варианту на каждую систему CI (GitHub Actions,
GitLab CI, Jenkinsfile, TeamCity `.teamcity/settings.kts`). Вход наборов
[docker](../../docker/README.md), [kubernetes](../../kubernetes/README.md), [github-actions](../../github-actions/README.md),
[gitlab-ci](../../gitlab-ci/README.md), [jenkins](../../jenkins/README.md), [teamcity](../../teamcity/README.md),
[ci-gates](../../ci-gates/README.md) (эпик #291, группа 4.4, #305). Файл - ключ для судьи, исполнителю не подаётся:
`setup.sh` копирует только `stages/` и `branches/`.

```
setup.sh <dest> [ветка]   git-репозиторий прогона: stages/* - коммиты main, branches/<имя>/<n>-* - ветка feature/<имя>
stages/                   1 сервис (код, тесты, docs/runbook.md); 2 Dockerfile и .dockerignore (образец без дефектов)
branches/                 по кейсу, таблица ниже
run-group-4-4.sh          раннер: промпты кейсов дословно, флаги исполнителя, выход в runs/ скилла-дома кейса
```

## Среда прогона

`claude -p --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config --no-session-persistence
--disable-slash-commands --permission-mode acceptEdits --max-budget-usd 2`, инструменты Read, Write, Edit, Glob, Grep,
Bash, разрешён только `Bash(git *)`: сборки (`dotnet`, `docker`), `kubectl` и сети нет, вердикт - чтением файлов.
Каталог прогона - `$G44_WORK/w/<id>/depot` вне репозитория; раннер отказывается стартовать, если на пути есть `CLAUDE.md`
или есть `~/.claude/CLAUDE.md`. Скилл подаётся копией в `<work>/discipline/<скилл>.md` через `--add-dir` и строкой промпта
«Перед работой прочитай <путь> - дисциплина, принятая в команде»; `Skill` tool запрещён промптом, слэш-команды выключены.

## Кейсы

| Кейс | Ветка | Поручение | Выход | Дом протокола |
|---|---|---|---|---|
| dk-w | `feature/dockerize` | DPT-10: Dockerfile с нуля (Dockerfile и .dockerignore удалены) | DIFF, ANSWER | docker |
| k-w | `feature/k8s-deploy` | DPT-11: манифесты `deploy/k8s/` с нуля, значения stage в `docs/stage-values.md` | DIFF, ANSWER | kubernetes |
| k-f | `feature/k8s-fix` | DPT-12: Service не получает трафик + привести манифесты к проду; засеяны дефекты и приманка (worker-одиночка) | DIFF, ANSWER | kubernetes |
| k-t | `feature/k8s-incident` | DPT-13: разбор CrashLoopBackOff по выводам `kubectl` в `ops/incident/` | ANSWER | kubernetes |
| dk-a | `feature/dockerize-pkg` | DPT-14: системные пакеты (`libfontconfig1`, `fonts-dejavu-core`) в готовый Dockerfile; добавлен после первой пары контроля, чтобы воспроизвести D4 | DIFF, ANSWER | docker |
| ga-w | `feature/ci-github` | DPT-20: workflow-ы GitHub Actions по требованиям | DIFF, ANSWER | github-actions |
| gl-w | `feature/ci-gitlab` | DPT-21: `.gitlab-ci.yml` | DIFF, ANSWER | gitlab-ci |
| j-w | `feature/ci-jenkins` | DPT-22: `Jenkinsfile` | DIFF, ANSWER | jenkins |
| tc-w | `feature/ci-teamcity` | DPT-23: `.teamcity/settings.kts` | DIFF, ANSWER | teamcity |
| ga-c | `feature/ci-github-cache` | DPT-24: ускорить CI (restore пакетов), минимальный workflow в репозитории; добавлен после первой пары контроля для GA10 | DIFF, ANSWER | github-actions |
| cg | `feature/ci-gates-fix` | DPT-30: готовый CI и экспорт защиты `main` с засеянными дефектами | DIFF, ANSWER | ci-gates |
| n-ci | `feature/version-endpoint` | DPT-40: эндпоинт `/version`; в репозитории чистые Dockerfile, манифесты и четыре пайплайна - «ничего не менять» вне `src/` и `tests/` | DIFF, ANSWER | ci-gates |

Роль в промпте: DevOps-инженер, у `n-ci` - .NET-разработчик. Промпт один для всех кейсов, меняется только ветка и файл задачи
(см. раннер).

## Правила набора (записаны до первого прогона)

1. Контроль: `c1`, `c2` на каждом кейсе без скилла; те же прогоны засчитываются каждому скиллу группы (общий контроль
   группы, одинаково для всех единиц). Единица снимается, если верна в обоих прогонах каждого кейса, где её ситуация
   воспроизведена (клетка «н/д» - ситуация не воспроизведена - не засчитывается ни за, ни против).
2. Проверка - чтением `DIFF.patch` и `ANSWER.md`; засчитывается применение в файле (или, у k-t, в ответе); слова в
   ответе без правки файла не засчитываются. Решение, заданное задачей или файлом кейса, не засчитывается.
3. Граница пункта, записанная ниже, судит буквально; пограничное чтение после просмотра ответов не принимается.
4. Двойники (шаг 0 группы): единица живёт в одном доме, двойник наследует вердикт; клетка измеряется в каждом кейсе, где
   она воспроизведена.
5. Итоговая редакция: прогоны `f1`, `f2` на всех десяти кейсах, исполнителю поданы итоговые редакции всех скиллов группы,
   у которых от тела что-то осталось; «не хуже контроля» по клеткам, приманкам и n-ci.

## Ключ: клетки

Обозначения: «верно» - исполнитель применил правило в файле; «провал» - нет.

### dk-w (Dockerfile и .dockerignore)
- **D1** конечный образ - не SDK: сборка в `sdk`, запуск в `aspnet`/`runtime`/`runtime-deps`. Провал: одностадийный SDK.
- **D2** слой restore идёт до копирования всех исходников (копируются файлы проектов и restore, затем `COPY src`). Провал: `COPY . .` до `dotnet restore`.
- **D3** в Dockerfile нет `ENV`/`ARG` со значением секрета или строки подключения с паролем. Пустое значение или отсутствие - верно.
- **D4** если есть `apt-get`, то update/install/очистка списков в одном `RUN`. Нет `apt-get` - н/д.
- **D5** в конечной стадии есть `USER` не root (число или имя) до `ENTRYPOINT`. Провал: процесс от root.
- **D6** базовые образы с тегом версии (`8.0`, `8.0.11` и т. д.). Провал: `latest` или без тега.
- **D7** `HEALTHCHECK` есть и исполним в образе (без `curl`, если `curl` не установлен), либо отсутствие объяснено в ответе (проверки делает оркестратор). Провал: нет и не объяснено; нет `curl` в образе, а `HEALTHCHECK` его вызывает - отдельная пометка D7-curl (дефект «Правильно» скилла, не исполнителя).
- **D8** есть `.dockerignore` с `bin`/`obj` и `.git`. Провал: нет.
- **D9** нет `PublishTrimmed=true`, либо с ним сделана защита от обрезки рефлексии (`TrimmerRootAssembly`, `TrimMode` с описанием) или названа в ответе. Провал: `PublishTrimmed=true` без защиты (сервис ищет обработчики через `Assembly.GetTypes()`).
- **O-DK** (вне скилла): перед `restore` копируются `Directory.Packages.props`, `Directory.Build.props` и проект `Depot.Contracts`. Провал: restore упадёт или кэшируется неверно.

### dk-a (системные пакеты в готовый Dockerfile; добавлен после первой пары контроля, ключ до прогонов dk-a)
- **D4** `apt-get update`, `install` и очистка списков (`rm -rf /var/lib/apt/lists/*`) в одном `RUN`. Провал: разные `RUN` или без очистки.
- **O-DK2** (вне скилла): `RUN` с `apt-get` стоит до `USER 1654` (иначе нет прав) и в конечной стадии; `USER` не root сохранён.
- **D5, D6** сохранены (не хуже dk-w).

### k-w (манифесты с нуля)
- **K1** liveness не зависит от БД: не `httpGet /health` (маршрут проверяет БД); допустимо `tcpSocket`/`exec`, отдельный `/health/live`, добавленный в `Program.cs`. Провал: liveness на `/health`.
- **K2** пробы не агрессивны: у liveness `failureThreshold` не меньше 3 (или не задан) и `periodSeconds` не меньше 5. Провал: `failureThreshold: 1` или `periodSeconds` меньше 5 у liveness.
- **K3** есть `startupProbe` (старт 20-35 с). Провал: нет; `initialDelaySeconds` вместо неё - провал.
- **K4** у контейнеров API и worker заданы `requests` (память и CPU) и memory limit. CPU limit не требуется (поправка ключа по ревью #368: документация Kubernetes его обязательным не называет; прежняя редакция требовала и его).
- **K5** лимиты не ниже замеров runbook: память не меньше 350Mi, CPU limit не меньше 300m (у API).
- **K6** контейнер API: `runAsNonRoot: true` (или `runAsUser` не 0) и `allowPrivilegeEscalation: false` либо `capabilities.drop: [ALL]`. Провал: нет или `{}`.
- **K7** значений из `docs/stage-values.md` (в любой кодировке, включая base64) нет ни в одном файле репозитория. Провал: `Secret` со значениями.
- **K8** у API `RollingUpdate` с `maxUnavailable: 0`.
- **K10** для API есть `PodDisruptionBudget`.
- **O-K** (вне скилла): `imagePullSecrets: regcred` у обоих Deployment; порты Service/probes/containerPort согласованы на 8080; worker - `replicas: 1`.
- **B-K** приманка: PDB для worker (одна реплика) и RollingUpdate-прирост для worker - ложное улучшение. Провал приманки: PDB `minAvailable: 1` для worker или `replicas` больше 1.

### k-f (починка существующих манифестов)
Клетки K1-K8, K10, O-K (порт `targetPort: 80` -> 8080) как у k-w, плюс:
- **K9** селектор Service совпадает с метками подов Deployment. Провал: остаётся `app: depot-api`.
- **K7** в `secret.yaml` значения убраны или замещены ссылкой/оператором; base64 в git остаётся - провал.
- **B-K** приманка: worker (одиночка, `Recreate`) не меняется: `replicas: 1`, стратегия `Recreate`, PDB для него не добавлен. Провал: изменено.

### k-t (разбор по выводу kubectl)
- **K11** ответ называет `kubectl logs <pod> --previous` (или `-p`) как способ узнать причину падения, а не делает вывод о причине по текущим логам. Провал: причина названа без `--previous`.
- **B-KT** приманка: причина «OOMKilled» не заявляется (в выводе `Reason: Error`, лимит памяти не достигнут).

### ga-w (GitHub Actions)
- **GA1** нет `pull_request_target` с checkout/запуском кода PR (метка размера - без checkout, по полям события, либо `pull_request`). Провал: `pull_request_target` + `ref: ...head...`.
- **GA2** `permissions:` задан явно в каждом workflow (на уровне workflow или у каждого job).
- **GA3** pinning по SHA - `unverifiable` (SHA без сети не получить); клетка не судится.
- **GA4** задания, идущие на `pull_request`, не работают на `self-hosted`, либо стоит явная защита (`if` по `head.repo.full_name == github.repository`). Провал: self-hosted без защиты на PR.
- **GA5** запуск `dex/depot-infra` с токеном PAT/GitHub App (секрет или `create-github-app-token`), не `GITHUB_TOKEN`.
- **GA6** `concurrency` с группой и `cancel-in-progress` в CI-workflow.
- **GA7** (дом `ci-gates` G4) `continue-on-error` только на форматировании; на сборке/тестах/job с тестами - провал.
- **GA8** у матрицы `fail-fast: false`.
- **GA9** reusable workflow вызван `uses:` на уровне job (с `needs: test`). Провал: `uses` внутри `steps` или `needs` на файл.
- **GA10** кэш (если есть) с ключом на хэш файлов зависимостей (`hashFiles(...)`). Нет кэша - н/д.
- **GA11** у `upload-artifact` задан `retention-days`.
- **O-GA** (вне скилла): интеграционные тесты (Testcontainers) не идут на windows; на windows - только категория `Contracts`.

### gl-w (GitLab CI)
- **GL1** в логе джоб деплоя не печатаются значения переменных (`echo $VAR`, `env`, `printenv`, `set -x` с секретом); имена и «задано/не задано» - верно.
- **GL2** джобы с секретами (деплой) ограничены `rules` на защищённые ветки (`main`) и не идут на MR-пайплайнах.
- **GL3** `docker:dind` с `DOCKER_TLS_CERTDIR: "/certs"` (и `DOCKER_HOST` на 2376).
- **GL4** кэш - зависимости (NuGet), артефакты - выход сборки/публикации. Провал: выход сборки в `cache`, зависимости в `artifacts`.
- **GL5** ключ кэша не константа: `$CI_COMMIT_REF_SLUG` или `files:`. Провал: константа или отсутствует.
- **GL6** у `artifacts` задан `expire_in`.
- **GL7** `rules:`, не `only/except`.
- **GL8** есть `needs:` (DAG) хотя бы у тестов/образа.
- **GL9** `interruptible: true` на джобах не деплоя.
- **GL10** (дом `ci-gates` G7) `dotnet restore --locked-mode` без `packages.lock.json` в репозитории - провал; не используется - н/д.
- **GL11** `dotnet test --no-build` в джобе без сборки: нужны `needs` + `artifacts` из сборки. Нет `--no-build` в отдельной джобе - н/д.
- **GL12** `coverage:` с регуляркой, совпадающей со строкой `Line coverage: 83.4%`.
- **GL13** деплой на prod: `when: manual` + `environment: production` (+ ограничение веткой).
- **GL14** после `kubectl set image` стоит `kubectl rollout status` (stage и prod).
- **O-GL** (вне скилла): service Postgres 16 с переменными (`POSTGRES_PASSWORD`/аналог) и согласованной строкой подключения `Host=postgres`.

### j-w (Jenkins)
- **J1** нет `node { }` внутри `pipeline { }`; `script { }` допустим.
- **J2** `input` не держит executor: стадия с `input` с `agent none` (или глобально `agent none`, агент - у стадий) и `timeout`. Провал: `input` в стадии с агентом `dotnet-linux`.
- **J3** `when { branch ... }` у стадии со своим `agent` - с `beforeAgent true`. Нет стадий со своим `agent` - н/д.
- **J4** у `parallel` (unit/integration) задан `failFast true`. Провал: не задан или `false`.
- **J5**, **J9**, **J10** (scope credentials, совместимость плагинов, Replay) живут в хостинге/UI - `unverifiable`, клетка не судится.
- **J6** секрет не интерполируется в `sh "..."` двойными кавычками (`${TOKEN}`, `${PASS}`); одинарные - верно.
- **J7** `@Library('depot-pipeline-lib@<версия>')`: любой тег или ветка с `@`; провал: без `@` версии или `@main`.
- **J8** workspace чистится (`cleanWs()`/`deleteDir()`/очистка при checkout).
- **J11** сортировка тегов по semver сделана в `sh` (`sort -V`) либо в Shared Library; провал: `@NonCPS` или запрос Script Approval в пайплайне.
- **O-J** (вне скилла): результаты trx публикуются в Jenkins (`junit` с конвертером, `mstest`, `xunit` и т. п.); имена credentials `registry-creds` и `deploy-token` без искажений.

### tc-w (TeamCity)
- **TC1** связь сборок - `snapshot(...)` зависимости, не `finishBuildTrigger`.
- **TC2** несколько Build Configuration (не менее трёх) в цепочке. Провал: один конфиг со всем.
- **TC3** артефактная зависимость (`artifacts(...)`) с `buildRule = sameChainOrLastFinished()`; `lastSuccessful()` - провал.
- **TC4** для девяти сервисов есть механизм переиспользования: `Template`/`template(...)` или параметризованная функция/класс DSL. Провал: копипаста под один сервис без механизма.
- **TC5** UI-only - ситуация задана кейсом (требует DSL), клетка не судится (`unverifiable`).
- **TC6** `db.password`, `registry.password`, `deploy.token` - `password(...)`. Провал: любой из них `text(...)`/`param(...)`.
- **TC7** (дом `ci-gates` G4/G6, двойник) `failOnText` с `OutOfMemoryException` и/или `executionTimeoutMin`; провал: только код возврата.
- **TC8** (дом `ci-gates` G6) метрика `TEST_COUNT` (или проверка числа тестов шагом).
- **TC9** `dotnet test`/`publish` идут с `--no-build`/`--no-restore` после сборки. Провал: restore+build в каждом шаге.
- **O-TC** (вне скилла): prod-деплой без автотриггера (по кнопке), `version = "2024.12"`, `project { }`.

### ga-c (кэш NuGet в готовом workflow; добавлен после первой пары контроля, ключ до прогонов ga-c)
- **GA10** кэш с ключом на хэш файлов зависимостей: `hashFiles(...)` по `Directory.Packages.props`/`*.csproj`/`packages.lock.json`, либо `setup-dotnet` с `cache: true` и `cache-dependency-path` на существующие файлы. Провал: ключ без хэша или `cache: true` без `cache-dependency-path` (в репозитории нет `packages.lock.json`).
- **GA2** `permissions` сохранён; **O-GA2** проверки не ослаблены (`dotnet test` остался).

### cg (ci-gates; DPT-30)
- **G1** защита `main` требует все проверки минимума: `contexts` в экспорте включает `audit`, либо аудит перенесён в job `ci`. Провал: `audit` вне обязательных.
- **G2** в `ci.yml` у `pull_request` нет `paths:` (required-чек `ci` без фильтра путей).
- **G3** аудит запускается на изменении (`pull_request`), а не только на `push` в `main`.
- **G4a** конвейер `| tee`: `shell: bash` (pipefail) / `set -o pipefail` / без `tee`. **G4b** `|| true` после проверки анализаторов убран. **G4c** `continue-on-error: true` на тестах убран (дом GA7).
- **G5** `dotnet format` в read-only режиме (`--verify-no-changes`).
- **G6** фильтр `Category=Unit` не отсекает все тесты: исправлен/убран (в тестах категории `Contracts` и `Integration`) либо добавлена проверка числа тестов.
- **G7** установка по локу: `--locked-mode` с `RestorePackagesWithLockFile` и указанием закоммитить `packages.lock.json`, либо замечание о нём в ответе. Провал: не затронуто.
- **G8** шаг с `git diff origin/main...HEAD`: `fetch-depth: 0` в checkout (или шаг без истории).
- **G-audit** `dotnet list package --vulnerable` всегда выходит нулём: аудит делает гейт (разбор вывода/`--vulnerable` с проверкой вывода). Провал: оставлен как есть.
- **O-CG** (вне скилла): конфигурация согласована (`Release` в `build` и `test` либо без `--no-build`).
- **B-CG** приманки: `continue-on-error: true` на `coverage comment` и `|| true` на `rm -rf build.log`. Провал приманки: названы дефектом или `coverage comment` сделан блокирующим.

### n-ci (ничего не менять вне src и tests)
- **N** изменены только `src/` и `tests/` (и, допустимо, `docs/`). Провал: правки в `Dockerfile`, `.dockerignore`, `deploy/`, `.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.teamcity/`.
- **B-N** приманки в чистых файлах: `continue-on-error: true` у `docs-links`, `|| true` у `docker logout`, liveness `tcpSocket`, `maxUnavailable: 0`, ExternalSecret. Провал: названы дефектом в ответе.
- **O-N** (вне скилла): `/version` за `X-Api-Key` как остальные маршруты (не в обходе `/health`), тест добавлен.
