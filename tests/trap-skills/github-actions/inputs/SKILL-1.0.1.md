---
name: github-actions
description: GitHub Actions CI/CD — ловушки workflows, безопасность, кэширование. Активируется при github actions, workflow, .github/workflows, GITHUB_TOKEN, actions/checkout, matrix, pull_request_target, concurrency, self-hosted runner, permissions
---

# GitHub Actions — ловушки и anti-patterns

## Безопасность

### pull_request_target + checkout PR head

Плохо: `on: pull_request_target` с `actions/checkout@v4` и `ref: ${{ github.event.pull_request.head.sha }}`
Правильно: `on: pull_request` для untrusted code; `pull_request_target` только для labeling/commenting без checkout PR кода
Почему: `pull_request_target` запускается с write-доступом и секретами репо. Checkout PR head = выполнение произвольного кода из fork с полными правами

### Нет permissions блока

Плохо: workflow без `permissions:` — GITHUB_TOKEN получает все default permissions
Правильно: `permissions: contents: read` на уровне workflow, расширять per-job
Почему: принцип least privilege. Без явного ограничения скомпрометированный step может пушить код, удалять releases, менять настройки

### Action pinning по tag вместо SHA

Плохо: `uses: actions/checkout@v4` — tag мутабелен, может быть перезаписан
Правильно: `uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11` с комментарием `# v4.1.1`
Почему: supply chain attack — злоумышленник с доступом к action-репо перезаписывает tag, все workflows получают вредоносный код

### Self-hosted runner без изоляции

Плохо: self-hosted runner принимает jobs от fork PR без ограничений
Правильно: `runs-on: self-hosted` только для protected branches; fork PR — на GitHub-hosted runners
Почему: fork PR выполняет произвольный код на вашей инфраструктуре — доступ к сети, файловой системе, credentials на runner

### GITHUB_TOKEN vs PAT для cross-repo

Плохо: `GITHUB_TOKEN` для trigger workflow в другом репозитории — тихо не работает
Правильно: PAT или GitHub App token с cross-repo scope
Почему: `GITHUB_TOKEN` scoped только на текущий репозиторий. Workflow dispatch в другой repo тихо возвращает 404

## Workflows

### Concurrency без группы

Плохо: push и pull_request triggers без `concurrency:` — дублирующиеся runs
Правильно: `concurrency: group: ${{ github.workflow }}-${{ github.ref }}` с `cancel-in-progress: true`
Почему: push в ветку + открытый PR = два параллельных run на один и тот же код. Удвоение нагрузки и путаница в статусах

### continue-on-error маскирует failures

Плохо: `continue-on-error: true` на step с тестами или линтером
Правильно: `continue-on-error` только для non-critical optional checks (e.g., experimental lint rule)
Почему: job остаётся зелёным при реальных ошибках. CI теряет смысл — merge проходит с broken tests

### Matrix без fail-fast контроля

Плохо: matrix build с default `fail-fast: true` для независимых платформ
Правильно: `fail-fast: false` когда нужны результаты всех комбинаций (cross-platform, multi-version)
Почему: один flaky test на Ubuntu отменяет Windows и macOS builds. Результат — неизвестно, работает ли код на других платформах

### Reusable workflow: needs vs uses

Плохо: `needs: [called-workflow]` для вызова reusable workflow
Правильно: `uses: org/repo/.github/workflows/ci.yml@main` на уровне job
Почему: `needs` — зависимость между jobs в одном workflow. `uses` — вызов другого workflow. Путаница ведёт к syntax error без понятного сообщения

## Кэш и артефакты

### Cache key без hash lock-файла

Плохо: `key: ${{ runner.os }}-node` — один cache для всех версий зависимостей
Правильно: `key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}`
Почему: без hash lock-файла cache не инвалидируется при обновлении зависимостей. Билд использует stale node_modules, тесты проходят локально но не в CI

### Artifact retention не настроен

Плохо: `actions/upload-artifact` без `retention-days`
Правильно: `retention-days: 7` (или меньше для промежуточных артефактов)
Почему: default retention 90 дней. 100 PR/день x 50MB артефактов = 450GB/месяц storage costs

## Чек-лист

- `permissions:` задан явно на уровне workflow
- Actions pinned по SHA, не по tag
- `concurrency` с `cancel-in-progress` для push + PR
- `pull_request_target` не используется для checkout PR кода
- Self-hosted runners изолированы от fork PR
- Cache key включает hash lock-файла
- Artifact retention настроен
