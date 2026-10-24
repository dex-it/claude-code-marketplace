---
name: playwright
description: Playwright E2E - локаторы по роли и подписи вместо CSS, вход без формы в каждом тесте, отладка через Inspector, headed в WSL. Активируется при playwright, e2e, browser automation, locator, getByRole, getByLabel, storageState, логин в тестах, page.pause, PWDEBUG, headed, WSL, X-сервер
---

# Playwright - чек-лист

Пункт называет ситуацию, которую тест проверяет.

- Локаторы по CSS-классам и id вместо роли, подписи и текста
- Вход через UI в каждом тесте

## Отладка и среда

### Дебаг через `console.log`, не Inspector
Плохо: `console.log(await page.content())` для понимания что упало
Правильно: `PWDEBUG=1 npx playwright test ...` или `await page.pause()` в точке интереса
Почему: вывод `page.content()` -- стена HTML без контекста, в которой не виден viewport / actions / network. Inspector / `page.pause()` дают пошаговое исполнение, snapshot DOM, evaluation panel.

### Headed без X-сервера в WSL
Плохо: `npx playwright test --headed` в WSL без WSLg / VcXsrv
Правильно: запускать headless или настроить WSLg (Win 11) / X-сервер (Win 10)
Почему: chromium/firefox/webkit в headed-режиме требуют display server; в WSL без X получают cryptic ошибку "no DISPLAY" / segfault.
