Я добавил job `e2e` в CI и настроил отчёты Playwright. Сам e2e-прогон я не запускал: браузеры Playwright не установлены. `npm run typecheck` проходит. Новый job и загрузку артефактов не проверял — для этого нужен реальный запуск в GitHub Actions.

Изменённые файлы:
- `.github/workflows/ci.yml`
- `e2e/playwright.config.ts`

Решения:
- **Запуск и красная сборка:** новый job `e2e` в существующем `ci.yml` запускается на PR и на push в `main`. Он ставит Chromium через `playwright install --with-deps` и выполняет `npm test -w e2e`. Падение теста даёт ненулевой код выхода, и сборка краснеет.
- **Разбор упавших тестов:** в конфиге включены `trace: 'retain-on-failure'` и скриншот при падении. Трейс показывает шаги, состояние DOM на каждом шаге, сетевые запросы и консоль. В CI добавлены HTML-репортёр и `forbidOnly`.
- **Артефакты:** `e2e/playwright-report/` и `e2e/test-results/` загружаются как `e2e-report` через `upload-artifact` с условием `!cancelled()`, то есть и при падении тестов. Хранятся 14 дней.