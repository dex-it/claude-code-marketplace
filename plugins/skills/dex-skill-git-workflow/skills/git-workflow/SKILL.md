---
name: git-workflow
description: Git workflow, branching, commits, code review, merge requests. Активируется при упоминании git, branch, commit, merge request, MR, PR, code review, rebase, cherry-pick, конфликт
allowed-tools: Read, Grep, Glob
---

# Git Workflow

## Branching Strategy (Git Flow)

```
main          ← production, только через MR
  └─ develop  ← интеграционная ветка, только через MR
       ├─ feature/TASK-123-user-auth    ← новая функциональность
       ├─ fix/TASK-456-login-error      ← исправление бага
       ├─ hotfix/TASK-789-critical-fix  ← срочное исправление в main
       └─ release/1.2.0                 ← подготовка релиза
```

### Именование веток

| Тип | Формат | Пример |
|-----|--------|--------|
| Feature | `feature/TASK-ID-description` | `feature/TASK-123-user-auth` |
| Bug fix | `fix/TASK-ID-description` | `fix/TASK-456-login-error` |
| Hotfix | `hotfix/TASK-ID-description` | `hotfix/TASK-789-critical` |
| Release | `release/X.Y.Z` | `release/1.2.0` |

### Правила

- `main` и `develop` — защищённые, только через MR/PR
- Feature ветки создаются от `develop`
- Hotfix ветки создаются от `main`, мержатся в `main` И `develop`
- Удаляй ветку после мержа

## Conventional Commits

```
<type>(<scope>): <description>

[body]

[footer]
```

### Типы коммитов

| Тип | Когда | Пример |
|-----|-------|--------|
| `feat` | Новая функциональность | `feat(auth): add JWT refresh tokens` |
| `fix` | Исправление бага | `fix(api): handle null user in /profile` |
| `refactor` | Рефакторинг без изменения поведения | `refactor(orders): extract validation logic` |
| `test` | Добавление/изменение тестов | `test(auth): add login edge cases` |
| `docs` | Документация | `docs(api): update endpoint descriptions` |
| `chore` | Обслуживание (CI, deps, config) | `chore(deps): update EF Core to 8.0.3` |
| `perf` | Улучшение производительности | `perf(queries): add index on OrderDate` |
| `ci` | CI/CD изменения | `ci(gitlab): add staging deploy job` |

### Правила сообщений

- Императив: `add`, `fix`, `update` (не `added`, `fixes`)
- Первая строка до 72 символов
- Body — зачем, а не что (diff покажет что)
- Footer — `BREAKING CHANGE:` или `Closes TASK-123`

```
feat(orders): add bulk order creation endpoint

Customers need to create multiple orders in one request
to reduce API calls during import.

Closes TASK-234
```

## Code Review Checklist

### Автор MR — перед созданием

- [ ] Код компилируется и тесты проходят
- [ ] Нет закомментированного кода и debug-выводов
- [ ] Ветка актуальна (rebase от develop)
- [ ] MR описание: что, зачем, как тестировать
- [ ] Маленький MR (до 400 строк, один логический блок)

### Ревьюер — при проверке

- [ ] Код читаем, именование понятно
- [ ] Нет дублирования логики
- [ ] Обработка ошибок и edge cases
- [ ] Безопасность: auth, validation, injection
- [ ] Тесты покрывают изменения
- [ ] Нет секретов в коде

### Размер MR

| Строк | Оценка | Действие |
|-------|--------|----------|
| < 200 | Отлично | Быстрый ревью |
| 200-400 | Нормально | Стандартный ревью |
| 400-800 | Большой | Разбей если возможно |
| > 800 | Слишком большой | Обязательно разбить |

## Rebase vs Merge

```
# Обновить feature-ветку от develop — rebase
git fetch origin
git rebase origin/develop

# Влить feature в develop — merge (через MR)
# НЕ делай rebase публичных веток (develop, main)
```

### Когда rebase

- Обновить свою feature-ветку от develop
- Склеить мелкие коммиты перед MR (`git rebase -i`)

### Когда merge

- Влить feature в develop (через MR)
- Влить hotfix в main (через MR)

## Конфликты

```
# 1. Обнови ветку
git fetch origin
git rebase origin/develop

# 2. При конфликте — resolve вручную
# Открой файл, найди маркеры <<<<< ===== >>>>>

# 3. После разрешения
git add <resolved-files>
git rebase --continue

# 4. Если всё пошло не так
git rebase --abort
```

### Правила разрешения

- Не удаляй чужой код молча — разберись что он делает
- При сомнениях — спроси автора конфликтующего кода
- После разрешения — прогони тесты

## Полезные команды

```bash
# Посмотреть что изменилось в ветке относительно develop
git log develop..HEAD --oneline

# Найти коммит, сломавший тест
git bisect start
git bisect bad HEAD
git bisect good <known-good-commit>

# Перенести один коммит в другую ветку
git cherry-pick <commit-hash>

# Отменить последний коммит (сохранив изменения)
git reset --soft HEAD~1

# Временно сохранить изменения
git stash push -m "WIP: description"
git stash pop
```
