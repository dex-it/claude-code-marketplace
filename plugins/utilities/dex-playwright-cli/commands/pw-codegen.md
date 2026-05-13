---
description: Запустить Playwright codegen для записи действий и генерации кода теста
user-invocable: true
allowed-tools: Bash
argument-hint: "<url> [--target javascript|typescript|python|csharp] [--browser chromium|firefox|webkit] [--device 'iPhone 13'] [--output path]"
---

# /pw-codegen

Запустить рекордер `npx playwright codegen` для записи UI-действий и автоматической генерации теста.

**Goal:** Получить starter-код теста, который потом доводится руками (замена селекторов на role-based, добавление assertions, выделение helper'ов).

**Output:** Путь к сгенерированному файлу (если задан `--output`) или текст кода в stdout. Подсказка: дальше нужно заменить созданные `page.locator('text=...')` на `page.getByRole(...)` и добавить web-first assertions.

**Scenarios:**

- `<url>` -- открыть URL и записывать действия (клики, ввод, navigation).
- `--target typescript` -- TypeScript (`@playwright/test` синтаксис) -- дефолт для большинства проектов.
- `--target python|csharp|javascript` -- альтернативные языки байндинга.
- `--browser firefox|webkit` -- записать в конкретном движке (для проверки cross-browser-отличий).
- `--device "iPhone 13"` -- эмуляция мобильного viewport + user-agent.
- `--output tests/recorded.spec.ts` -- сохранить сразу в файл.
- `--save-storage auth.json` + `--load-storage auth.json` -- залогиниться один раз, переиспользовать сессию.

**Constraints:**

- Интерактивная команда. Открывает реальный браузер (headed) -- нужен GUI. В WSL без X-сервера / WSLg не запустится; на удалённом сервере проброс X11 / VNC обязателен.
- Сгенерированный код использует text-based / CSS селекторы, которые ломаются при ребрендинге UI. Цель codegen -- starter, не финальный тест. После записи -- мигрировать на `getByRole` / `getByLabel` (см. `dex-skill-playwright`).
- Запись открывает реальную сессию в URL: cookies, OAuth callback, формы -- всё уходит на сервер. Использовать staging-домены, не прод с реальными пользовательскими данными.
- `--save-storage` сохраняет cookies + localStorage -- этот файл содержит auth-токены, не коммитить, права 600.
