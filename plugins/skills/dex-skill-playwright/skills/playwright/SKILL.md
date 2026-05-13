---
name: playwright
description: Playwright E2E ловушки -- locators, auto-waiting, isolation, network mocking, traces, fixtures. Активируется при playwright, e2e, browser automation, locator, getByRole, page object, fixture, trace, codegen, headed, headless, storageState
---

# Playwright -- ловушки и anti-patterns

## Locators

### CSS-селекторы вместо role-based
Плохо: `page.locator('.btn-primary')` или `page.locator('#submit')`
Правильно: `page.getByRole('button', { name: 'Submit' })`, `getByLabel`, `getByPlaceholder`
Почему: CSS-классы и id меняются при ребрендинге / рефакторинге дизайн-системы, тесты падают без изменения функциональности. Role + accessible name стабильны: они отражают семантику, не визуал.

### `getByText` без exact
Плохо: `page.getByText('Save')` -- поймает "Save", "Save as", "Save changes"
Правильно: `page.getByText('Save', { exact: true })` или `getByRole('button', { name: 'Save' })`
Почему: substring-матчинг ловит лишние элементы. В strict mode locator с multiple matches кидает исключение, в обычном режиме -- молча берёт первый.

### CSS-локатор с multiple matches
Плохо: `page.locator('input').fill('x')` при двух input на странице -- ошибка strict mode
Правильно: сузить через `getByRole('textbox', { name: 'Email' })` или `.nth(0)` если намеренно
Почему: locator-методы Playwright по умолчанию в strict mode (с v1.27+). Множественный матч = exception, чтобы тест не был случайно зависим от порядка DOM.

## Auto-waiting и assertions

### Manual `waitForTimeout` вместо web-first assertion
Плохо: `await page.click('button'); await page.waitForTimeout(2000); expect(...).toBe(...)`
Правильно: `await page.click('button'); await expect(page.getByText('Saved')).toBeVisible()`
Почему: `waitForTimeout` -- источник flake (на CI медленнее, на dev быстрее) и замедление набора. Web-first assertions автоматически ретрятся до `timeout` из конфига -- ждут ровно столько, сколько нужно.

### `expect(value).toBe(...)` для DOM-состояния
Плохо: `expect(await page.locator('h1').textContent()).toBe('Welcome')`
Правильно: `await expect(page.locator('h1')).toHaveText('Welcome')`
Почему: первый вариант снимает значение один раз и сравнивает; если DOM ещё не дорендерился -- падение. Второй ретрится с polling до `expect.timeout`. Web-first assertions работают только на locator-объектах, не на снятых значениях.

### `await locator.click()` -- но без assertion после
Плохо: клик + переход к следующему действию без проверки эффекта
Правильно: `await locator.click(); await expect(...).toBeVisible()` перед следующим шагом
Почему: click ждёт actionability (элемент видим, кликабелен), но не ждёт результата клика. Без assertion следующее действие может стартовать до того, как UI отреагировал -- flake.

## Test isolation

### Расшаренный browser context между тестами
Плохо: `test.beforeAll(async ({ browser }) => { context = await browser.newContext() })` и переиспользование между `test(...)`
Правильно: дефолтная фикстура `page` -- новый context на каждый тест
Почему: тесты не изолированы -- состояние cookies, localStorage, sessionStorage течёт между тестами; падение в test N меняет результат test N+1. Параллельные shards ломаются.

### Логин через UI в каждом тесте
Плохо: `test.beforeEach` с заполнением формы логина + submit -- N тестов = N логинов
Правильно: один global setup, сохранение `storageState`, переиспользование в проектах через `use: { storageState: 'auth.json' }`
Почему: время прогона растёт линейно по N тестов; идемпотентность нарушается (rate-limit на логин, бан IP, blocked-bot detection). Storage state -- проверенный паттерн (см. docs Playwright "Authentication").

### Забытый cleanup тестовых данных
Плохо: тест создаёт user/order через UI и не удаляет -- БД накапливает мусор
Правильно: cleanup через API в `afterEach` или `test.afterEach`, либо ephemeral окружение (Testcontainers, schema-reset)
Почему: shared staging-БД зарастает; следующий прогон ловит data conflict (unique constraint, name collision); параллелизм усугубляет.

## Network mocking

### `route.fulfill` без await перехвата перед navigation
Плохо: `page.route(...); await page.goto(url)` -- race между установкой route и navigation
Правильно: `await page.route('**/api/users', route => route.fulfill({...})); await page.goto(url)`
Почему: `page.route` сам по себе synchronous, но Playwright рекомендует await для определённости порядка установки. Без него первый запрос может уйти до того, как handler зарегистрирован.

### Забытый `page.unroute`
Плохо: установить mock в `beforeEach`, не убрать -- следующий тест ловит фейковый ответ
Правильно: `afterEach(async ({ page }) => { await page.unroute('**/api/users') })` или мок только внутри одного теста
Почему: route hooks накапливаются на контексте; даже с дефолтной изоляцией context, если контекст переиспользуется -- mocks остаются.

## Traces и debug

### `trace: 'on'` в CI-конфиге
Плохо: `use: { trace: 'on' }` в `playwright.config` -- trace для каждого прогона
Правильно: `trace: 'on-first-retry'` или `'retain-on-failure'`
Почему: trace.zip -- 1-10 МБ на тест; на 500 тестов это 500 МБ-5 ГБ артефактов в CI; долго загружается. Retain-on-failure тратит ресурсы только для упавших, где trace действительно нужен.

### Дебаг через `console.log`, не Inspector
Плохо: `console.log(await page.content())` для понимания что упало
Правильно: `PWDEBUG=1 npx playwright test ...` или `await page.pause()` в точке интереса
Почему: вывод `page.content()` -- стена HTML без контекста, в которой не виден viewport / actions / network. Inspector / `page.pause()` дают пошаговое исполнение, snapshot DOM, evaluation panel.

## Headed / WSL / CI

### Headed без X-сервера в WSL
Плохо: `npx playwright test --headed` в WSL без WSLg / VcXsrv
Правильно: запускать headless или настроить WSLg (Win 11) / X-сервер (Win 10)
Почему: chromium/firefox/webkit в headed-режиме требуют display server; в WSL без X получают cryptic ошибку "no DISPLAY" / segfault.

### `--with-deps` забыт на свежей машине
Плохо: `npx playwright install` без `--with-deps` на чистом Ubuntu CI -- браузеры есть, но `libnss3` / `libgbm` нет
Правильно: `npx playwright install --with-deps` на Linux, либо использовать `mcr.microsoft.com/playwright` Docker-образ
Почему: Playwright тянет сами браузеры, но не их runtime-зависимости. Без `--with-deps` -- ошибки запуска вроде `error while loading shared libraries`.

### Chromium-only matrix, забыт webkit/firefox
Плохо: `projects: [{ name: 'chromium' }]` -- баги Safari/Firefox ловятся только в проде
Правильно: все три движка в matrix, или хотя бы chromium + webkit (как proxy для Safari)
Почему: Playwright предлагает три движка ровно потому, что между ними реальные расхождения (CSS rendering, IntersectionObserver, видео-codec'и). WebKit ближе всего к Safari -- единственный способ ловить Safari-баги без macOS-парка.

## Page Object Model

### Публичные locators в POM
Плохо: `class LoginPage { emailInput = this.page.locator(...) }` -- тесты тыкают в `.emailInput`
Правильно: публичны только действия (`login(email, password)`) и assertions (`expectLoginError()`), locators private
Почему: при ребрендинге UI меняются locators, но не действия. Если тесты ссылаются на `.emailInput` -- ребрендинг ломает каждый тест; если только на `.login(...)` -- только реализация POM.

### Fluent-методы возвращают `this` вместо новой страницы
Плохо: `class LoginPage { async login() { ...; return this } }` -- после логина всё ещё `LoginPage`
Правильно: `async login(): Promise<DashboardPage> { ...; return new DashboardPage(this.page) }`
Почему: после успешного логина пользователь на dashboard, не на LoginPage. Возврат `this` ломает type-driven навигацию POM и допускает вызовы LoginPage-методов после перехода.
