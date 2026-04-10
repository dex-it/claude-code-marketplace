---
name: jenkins
description: Jenkins CI/CD — ловушки Jenkinsfile, shared libraries, credentials. Активируется при jenkins, jenkinsfile, declarative pipeline, scripted pipeline, shared library, groovy, credential binding, multibranch, input step, parallel stages, withCredentials
---

# Jenkins — ловушки и anti-patterns

## Pipeline

### Scripted vs Declarative смешивание

Плохо: `node { ... }` внутри `pipeline { stages { ... } }` — смешивание двух синтаксисов
Правильно: Declarative Pipeline для стандартных workflows; Scripted только когда Declarative не хватает (сложная логика, dynamic stages)
Почему: смешивание приводит к непредсказуемому поведению — Declarative validator не проверяет scripted блоки, ошибки всплывают в runtime

### input блокирует executor

Плохо: `input message: 'Deploy to prod?'` внутри `node { ... }` — executor занят пока ждёт ответ
Правильно: `input` вне `node` блока, или `timeout(time: 1, unit: 'HOURS') { input ... }` на уровне stage
Почему: executor (agent slot) заблокирован на время ожидания — часы или дни. Очередь билдов растёт, другие jobs ждут

### when без beforeAgent

Плохо: `when { branch 'main' }` без `beforeAgent true` — agent выделяется до проверки условия
Правильно: `when { beforeAgent true; branch 'main' }` — сначала проверка, потом agent
Почему: без `beforeAgent` Jenkins выделяет executor, проверяет условие, освобождает executor. На загруженном кластере — бессмысленная трата agent slots

### Parallel без failFast

Плохо: `parallel { ... }` без `failFast true` — все ветки выполняются до конца даже при failure
Правильно: `parallel { failFast true; ... }` когда результат одной ветки делает остальные бессмысленными
Почему: 5 parallel stages по 10 минут, первый падает через 1 минуту — 4 остальных работают ещё 9 минут зря. Agent slots заняты

## Security

### Credentials scope: folder vs global

Плохо: все credentials в Global scope — доступны любому pipeline
Правильно: credentials в folder scope, привязаны к конкретному проекту/команде
Почему: любой pipeline с Scripted syntax может прочитать global credentials через `withCredentials`. Компрометация одного репо = доступ ко всем секретам

### Credentials в build logs

Плохо: `echo "Deploying with ${PASSWORD}"` или `sh "curl -u user:${TOKEN} ..."`
Правильно: `withCredentials([string(credentialsId: 'token', variable: 'TOKEN')]) { sh 'curl -u user:$TOKEN ...' }` (одинарные кавычки)
Почему: двойные кавычки в Groovy интерполируют переменную ДО передачи в shell — credential попадает в build log в plain text. Jenkins mask не работает для интерполированных значений

### Shared Library implicit trust

Плохо: `@Library('shared-lib') _` без version pin — загружает latest с default branch
Правильно: `@Library('shared-lib@1.2.3') _` или `@Library('shared-lib@release/v1')` — pin конкретной версии
Почему: кто-то пушит в main shared library — все pipelines получают новый код автоматически. Broken library = broken все билды

## Операционные

### Stale workspace

Плохо: полагаться на чистый workspace — файлы от предыдущих билдов присутствуют
Правильно: `cleanWs()` в `post { always { ... } }` или `deleteDir()` в начале
Почему: предыдущий билд оставил артефакты, test results, temp files. Текущий билд использует stale данные — тесты проходят с чужими fixtures, сборка использует старые объектники

### Plugin compatibility после обновлений

Плохо: обновить 10 плагинов одновременно на production Jenkins
Правильно: staging Jenkins для тестирования обновлений; обновлять по одному; читать changelogs
Почему: plugin X требует plugin Y >= 2.0, но plugin Z несовместим с Y >= 2.0. Каскадный failure после массового обновления, rollback не всегда возможен

### Replay vs Jenkinsfile commit

Плохо: отлаживать pipeline через Replay, потом забыть перенести изменения в Jenkinsfile
Правильно: Replay только для быстрой проверки гипотезы; результат — commit в Jenkinsfile
Почему: Replay-изменения не сохраняются в репозитории. Следующий билд запустится со старым Jenkinsfile. Изменения потеряны

### Groovy sandbox ограничения

Плохо: `@NonCPS` или Script Approval для обхода sandbox без понимания последствий
Правильно: минимизировать Groovy логику в pipeline; сложную логику выносить в Shared Library с trust
Почему: `@NonCPS` отключает CPS-трансформацию — pipeline не может быть serialized/resumed после рестарта Jenkins. Script Approval = дыра в безопасности, если approval процесс формальный

## Чек-лист

- Declarative Pipeline, не Scripted (если нет веских причин)
- `input` вне `node` блока + `timeout`
- `when` с `beforeAgent true`
- Credentials в folder scope, не global
- Shared Library pinned по версии
- `cleanWs()` в `post { always }`
- Одинарные кавычки в `sh` для credentials
