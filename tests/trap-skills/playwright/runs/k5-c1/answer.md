E2E теперь запускаются в CI на каждый PR и на push в `main`. Запустить сам пайплайн и сами тесты здесь не удалось: браузеры Playwright не установлены, а у GitHub Actions нет сети. Проверен только `npm run typecheck -w e2e`, он проходит.

Изменённые файлы:
- `.github/workflows/ci.yml`
- `e2e/playwright.config.ts`

Решения:
- **Новая джоба.** В `ci.yml` добавлена джоба `e2e`: `npm ci`, `npx playwright install --with-deps chromium`, затем `npm test -w e2e`. Падение тестов делает сборку красной. Триггеры остались прежними.
- **Материалы для разбора.** В конфиге при `CI` включены HTML-отчёт и `trace: 'retain-on-failure'`. Трейс Playwright показывает шаги, снимки страницы, сетевые запросы и консоль упавшего теста. Локально трейс выключен.
- **Артефакт.** При падении `actions/upload-artifact` выгружает `e2e/playwright-report/` и `e2e/test-results/` как `e2e-report` на 14 дней. В `CI` также включён `forbidOnly`, чтобы случайный `test.only` не прошёл в сборку.