---
name: git-workflow
description: Git workflow, branching, commits, code review, merge requests. Активируется при git, branch, commit, merge request, MR, PR, code review, rebase, cherry-pick, gitflow, trunk-based, conventional commits, squash, stash, tag, hotfix
---

# Git Workflow — ловушки и anti-patterns

## Опасные операции

### Force push на shared branch
Плохо: `git push -f develop` — перезаписывает историю общей ветки
Правильно: `git push --force-with-lease` только на своей feature-ветке
Почему: коллеги теряют коммиты без предупреждения. `--force-with-lease` хотя бы проверяет что remote не изменился

### Rebase публичной ветки
Плохо: `git rebase develop` на ветке, которую уже pull-нули коллеги
Правильно: rebase только на своей ветке до push, или на уже push-нутой но solo-ветке
Почему: rebase переписывает хеши → у всех кто pull-нул — diverged history → конфликты при следующем pull

### Коммит в detached HEAD
Плохо: `git checkout <commit-hash>` → пишешь код → `git commit` → `git checkout develop`
Правильно: `git checkout -b temp-branch <hash>` → работай → merge
Почему: коммиты в detached HEAD не привязаны к ветке, garbage collector удалит их через ~2 недели. Работа потеряна

### Забытый .env / секреты в коммите
Плохо: `git add .` → `.env` с `DB_PASSWORD=prod123` попал в историю
Правильно: `.gitignore` с `.env` ДО первого коммита, `git add` по конкретным файлам
Почему: `git rm .env` удалит файл, но НЕ из истории. Секрет останется в `git log -p`. После push — секрет скомпрометирован, нужна ротация

## Ветвление

### Branch от branch от branch
Плохо: `feature-A` → `feature-B` → `feature-C` — цепочка зависимых веток
Правильно: все feature-ветки от `develop`, декомпозиция на независимые задачи
Почему: merge `feature-A` в develop → конфликты в `feature-B` и `feature-C` каскадом. Чем длиннее цепочка — тем больнее разрешать

### Долгоживущая feature-ветка
Плохо: feature-ветка живёт 3 недели без rebase от develop
Правильно: rebase от develop ежедневно или хотя бы раз в 2-3 дня
Почему: чем дольше ветка живёт — тем больше расхождение. Merge после 3 недель = десятки конфликтов вместо одного-двух

### Hotfix не влит в develop
Плохо: hotfix → merge в `main` → забыли merge в `develop`
Правильно: hotfix merge в `main` И `develop` (или cherry-pick в develop)
Почему: следующий release из develop не содержит hotfix → баг возвращается в production

## Коммиты

### Один коммит "fix stuff" на 500 строк
Плохо: `git commit -m "fix stuff"` — все изменения за день в одном коммите
Правильно: атомарные коммиты по одному логическому изменению, conventional commits
Почему: `git bisect` невозможен (500 строк в одном коммите), `git revert` откатывает всё, changelog нечитаемый

### Мерж без обновления от target branch
Плохо: создал MR из 2-недельной ветки без rebase → 30 конфликтов в MR
Правильно: `git rebase origin/develop` перед созданием MR, разрешить конфликты локально
Почему: конфликты в MR ревьюер разрешать не будет — MR повиснет. Локально разрешать проще (есть контекст)

### BREAKING CHANGE без предупреждения
Плохо: `feat(api): change response format` — сломан контракт, но коммит не сообщает
Правильно: `feat(api)!: change response format` + footer `BREAKING CHANGE: response field X renamed to Y`
Почему: downstream-сервисы/клиенты ломаются на деплое, а не на этапе ревью. `!` и footer попадают в changelog

## Code Review

### Гигантский MR (800+ строк)
Плохо: один MR на всю фичу — 2000 строк, 40 файлов
Правильно: серия MR по 200-400 строк: инфраструктура → domain → API → тесты
Почему: ревьюер не может качественно проверить 2000 строк → approve без проверки → баги в production

| Строк | Качество ревью |
|-------|---------------|
| < 200 | Тщательный, находит баги |
| 200-400 | Хороший, ловит основное |
| 400-800 | Поверхностный, пропускает |
| > 800 | LGTM без чтения |

### Approve без прогона тестов
Плохо: ревьюер смотрит код, жмёт Approve, CI падает после merge
Правильно: CI pipeline обязателен ДО approve (GitLab: `Pipelines must succeed`)
Почему: "у меня локально работает" + approve → merge → broken develop для всей команды

### Ревью стиля вместо логики
Плохо: 20 комментариев "переименуй переменную", 0 комментариев про race condition
Правильно: линтер и форматтер ловят стиль автоматически, ревьюер проверяет логику/безопасность/edge cases
Почему: человек плохо ловит стиль (субъективно) и хорошо ловит логические ошибки. Автоматизируй что можно

## Merge стратегии

### Cherry-pick вместо merge
Плохо: `git cherry-pick abc123` из feature-ветки в develop вместо merge
Правильно: merge/rebase целой ветки через MR
Почему: cherry-pick создаёт дубликат коммита (другой хеш), при merge ветки позже — конфликт с самим собой

### Squash merge теряет контекст
Плохо: squash merge фичи из 15 коммитов в один "Add feature X"
Правильно: squash мелких WIP-коммитов перед MR, merge с сохранением атомарных коммитов
Почему: один коммит на 1000 строк → `git bisect` бесполезен, `git blame` показывает одного автора на всё, потеря контекста "почему"

### Merge без стратегии для конфликтов
Плохо: `git merge` → конфликт → "принять все свои" (`--ours`) без разбора
Правильно: разбирать каждый конфликт, понять что делает чужой код, при сомнениях — спросить автора
Почему: `--ours` тихо удаляет чужие изменения. Автор конфликтующего кода узнает что его работа пропала только когда баг дойдёт до production

## Чек-лист

- `git push -f` запрещён на shared ветках, используй `--force-with-lease` на своих
- Feature-ветки от `develop`, не от других feature-веток
- Rebase от develop перед созданием MR
- Атомарные коммиты с conventional commits format
- MR до 400 строк, один логический блок
- CI pipeline обязателен до approve
- Hotfix → merge в main И develop
- `.gitignore` настроен ДО первого коммита
