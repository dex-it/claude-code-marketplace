---
description: Открыть Playwright Trace Viewer для разбора упавшего теста
user-invocable: true
allowed-tools: Bash
argument-hint: "<path-to-trace.zip | URL> [-p|--port N] [-h|--host host] [-b|--browser chromium|firefox|webkit]"
---

# /pw-trace

Открыть Trace Viewer через `npx playwright show-trace` для пошагового разбора прогона.

**Goal:** Увидеть для упавшего теста: timeline действий, snapshot DOM до/после каждого шага, network-запросы, console, screenshots, source.

**Output:** Локальный URL Trace Viewer (по умолчанию динамический порт). Подсказка о горячих клавишах timeline и о вкладках Actions / Network / Console / Source / Attachments.

**Scenarios:**

- `<path>` -- путь к `trace.zip`. Типичные расположения: `test-results/<test-name>-<browser>/trace.zip`, `playwright-report/data/<id>.zip`, артефакт CI после `actions/upload-artifact`.
- URL вместо пути -- открыть удалённый trace, например `https://example.com/trace.zip` (CI-артефакт по прямой ссылке).
- `-p N` / `--port N` -- альтернативный порт, если дефолтный (динамический) занят.
- `-h <host>` / `--host <host>` -- bind на другой интерфейс (`0.0.0.0` для доступа извне с SSH-туннелем).
- `-b firefox` / `--browser webkit` -- какой движок открыть для рендера UI viewer'а (дефолт chromium).

**Constraints:**

- Trace по умолчанию записывается только в режимах `trace: 'on-first-retry'` / `'retain-on-failure'` / `'on'` в `playwright.config`. Если для упавшего теста trace отсутствует -- проверить конфиг и поднять режим, перезапустить.
- Trace может содержать снапшоты DOM с PII, токенами в headers, cookies, telemetry-id. Не публиковать `.zip` в открытых тикетах / чатах -- передавать через приватный канал.
- На headless-сервере вьюер не откроет браузер; URL печатается -- открывать с локальной машины (если нужно -- `--host 0.0.0.0` + SSH-туннель).
- Trace Viewer не умеет восстанавливать состояние backend'a, только клиента. Запросы видны как payload, без серверного контекста -- сопоставлять с серверными логами по timestamp.
