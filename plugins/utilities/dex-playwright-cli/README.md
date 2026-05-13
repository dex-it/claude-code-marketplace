# dex-playwright-cli

CLI-утилита для Playwright. Запуск E2E-тестов, открытие HTML-отчёта, рекордер codegen, Trace Viewer и установка браузерных бинарей -- всё через `npx playwright`.

## Команды

| Команда | Описание |
|---------|----------|
| `/pw-test` | Запустить тесты с фильтрами по файлам, проектам, паттернам |
| `/pw-show-report` | Открыть HTML-отчёт последнего прогона |
| `/pw-codegen` | Рекордер действий с генерацией кода теста |
| `/pw-trace` | Trace Viewer для разбора упавшего теста |
| `/pw-install` | Скачать браузерные бинари (chromium / firefox / webkit) |

## Требования

- Node.js (для `npx`).
- Проект с установленным Playwright: `npm i -D @playwright/test` (создаёт `playwright.config`).
- Браузерные бинари -- ставятся через `/pw-install` после первой инициализации проекта.

Системного бинаря `playwright` нет -- всё работает через `npx playwright ...`, как у `dex-mcp-inspector`. Поэтому в `install-bundle/install-cli-tools.sh` рецепта для Playwright нет.

## Первое использование

```bash
# Внутри вашего проекта
npm i -D @playwright/test
npx playwright install --with-deps   # ИЛИ через слэш-команду:
# /pw-install --with-deps
npx playwright test                  # ИЛИ:
# /pw-test
```

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) -- общий хаб по CLI-плагинам, матрица установки, CLI vs MCP. Для Playwright-ловушек (locators, isolation, auto-wait, trace) -- см. `dex-skill-playwright`. Для автономного E2E-агента -- MCP-сервер `playwright` в `mcp/mcp-template.json`.

## Установка плагина

```bash
claude plugins install dex-playwright-cli@dex-claude-marketplace
```

## Безопасность

- `/pw-codegen` открывает реальный браузер с реальной сессией к указанному URL: cookies, OAuth callback, форма логина -- всё уходит на сервер. Использовать staging-домены, не прод с пользовательскими данными.
- `--save-storage` codegen и `storageState` тестов содержат auth-токены. Файлы не коммитить, `chmod 600`.
- HTML-отчёт и `trace.zip` могут содержать PII, токены в headers, скриншоты с конфиденциальными данными -- не публиковать `playwright-report/` и `test-results/` в открытых тикетах. На CI -- использовать private artifacts.
- `/pw-install --with-deps` запрашивает sudo и ставит системные пакеты. На managed/shared-машинах вместо этого использовать Docker-образ `mcr.microsoft.com/playwright`.
- `/pw-test` запускает тесты, которые через приложение могут писать в БД и внешние API. Прогонять против staging / dedicated test-окружения, не shared-prod.
