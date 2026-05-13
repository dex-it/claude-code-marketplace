---
description: Запустить Playwright-тесты через npx playwright test с фильтрами по файлам, проектам, паттернам
user-invocable: true
allowed-tools: Bash
argument-hint: "[file/glob] [--project chromium|firefox|webkit] [--grep pattern] [--headed] [--debug] [--ui] [--workers N] [--repeat-each N]"
---

# /pw-test

Запустить E2E тесты Playwright через `npx playwright test`.

**Goal:** Прогнать набор тестов, показать сводку pass/fail/flaky/skip, путь к HTML-отчёту и trace-артефактам для упавших тестов.

**Output:** Сводка прогона (всего/passed/failed/flaky/skipped), путь к `playwright-report/index.html` и `test-results/<test>/trace.zip` для упавших. Для конкретного запроса -- список упавших с краткой причиной из сообщения assertion.

**Scenarios:**

- Без аргументов -- `npx playwright test` (все тесты из `playwright.config`).
- `tests/auth.spec.ts` или glob `tests/**/login*.spec.ts` -- фильтр по файлам.
- `--project chromium|firefox|webkit` -- один браузер; без флага -- все проекты из конфига.
- `--grep "<pattern>"` -- фильтр по имени теста (regex).
- `--headed` -- открытие реального браузера (для локального дебага; в WSL нужен X-сервер).
- `--debug` -- запуск с инспектором (`PWDEBUG=1`), пошаговое выполнение; автоматически ставит `workers=1, timeout=0, max-failures=1, headed`.
- `--ui` -- Playwright UI Mode: time-travel дебаггер с пошаговым прогоном, watch-mode, pick locator. Альтернатива `--debug` для проектов с many тестами.
- `--workers N` -- параллелизм (дефолт 50% от CPU).
- `--repeat-each N` -- повторить каждый тест N раз для проверки на flake.

Флаг `--browser` существует, но deprecated в пользу `--project` (project задаётся в `playwright.config`; `--browser` принимает только chromium/firefox/webkit без кастомного device-emulation).

**Constraints:**

- Требует Node.js + проект с установленным Playwright (`@playwright/test` в `package.json`). Если `npx playwright --version` не отвечает -- предложить `npm i -D @playwright/test` и `/pw-install`.
- Если запуск падает с `browserType.launch: Executable doesn't exist` -- предложить `/pw-install`.
- Тесты могут писать в БД/внешние API через приложение. Запускать против staging / dedicated test-окружения, не против shared-prod.
- Headed-режим в WSL требует X-сервера (WSLg, VcXsrv); по умолчанию использовать `--headed=false`.
- Большой `--workers` нагружает CPU; для UI-тестов с `--headed` оставить дефолт.
