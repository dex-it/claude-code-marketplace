---
description: Установить браузерные бинари Playwright через npx playwright install
user-invocable: true
allowed-tools: Bash
argument-hint: "[chromium|firefox|webkit|chrome|msedge] [--with-deps] [--dry-run] [--force]"
---

# /pw-install

Скачать браузерные бинари Playwright через `npx playwright install`.

**Goal:** Получить нужные браузеры в кеш Playwright (`~/.cache/ms-playwright/` на Linux/macOS, `%USERPROFILE%\AppData\Local\ms-playwright\` на Windows). Без них `npx playwright test` падает на старте.

**Output:** Список того, что скачано / уже было, размер кеша, путь установки. Для `--with-deps` -- список установленных системных библиотек.

**Scenarios:**

- Без аргументов -- все браузеры из `playwright.config` (обычно chromium, firefox, webkit). Полная установка ~300 МБ.
- `chromium` / `firefox` / `webkit` -- один движок.
- `chrome` / `msedge` -- использовать системный Chrome / Edge (`channel: 'chrome'` в конфиге), скачивается только драйвер.
- `--with-deps` (Linux) -- доустановить системные пакеты (libnss3, libatk-bridge, libxkbcommon, libdrm, libgbm, ...). Требует sudo (apt/dnf/...).
- `--dry-run` -- показать, что было бы скачано, без скачивания.
- `--force` -- переустановить, даже если кеш есть.

**Constraints:**

- Команда тянет ~150-300 МБ через сеть. На metered-соединениях / CI с rate-limit -- использовать `--browser` для точечной установки.
- `--with-deps` запрашивает sudo и трогает системные пакеты. На shared/managed-машинах вместо `--with-deps` использовать предсобранный Docker-образ `mcr.microsoft.com/playwright`.
- На WSL подсистема `--with-deps` ставит deps в WSL-окружение, не в Windows-хост. Headed-режим в WSL дополнительно требует WSLg или X-сервера.
- Версия браузеров пинуется к версии `@playwright/test` в `package.json`. После обновления пакета -- перезапустить `/pw-install`, иначе ошибка `Executable doesn't exist`.
- В Docker-образе `mcr.microsoft.com/playwright:vX-jammy` всё уже предустановлено -- `/pw-install` там не нужен.
