---
description: Запустить Playwright codegen для записи действий и генерации кода теста
user-invocable: true
allowed-tools: Bash
argument-hint: "<url> [--target playwright-test|javascript|python|python-pytest|csharp|java] [-b|--browser chromium|firefox|webkit] [--device 'iPhone 13'] [--output path]"
---

# /pw-codegen

Запустить рекордер `npx playwright codegen` для записи UI-действий и автоматической генерации теста.

**Goal:** Получить starter-код теста, который потом доводится руками (замена селекторов на role-based, добавление assertions, выделение helper'ов).

**Output:** Путь к сгенерированному файлу (если задан `--output`) или текст кода в stdout. Подсказка: codegen предпочитает role-based locators (`getByRole`, `getByText`, `getByTestId`), но для non-semantic элементов может выпасть в `page.locator(...)` -- такие места стоит пересмотреть и добавить web-first assertions.

**Scenarios:**

- `<url>` -- открыть URL и записывать действия (клики, ввод, navigation).
- Без `--target` -- дефолт `playwright-test` (TypeScript для `@playwright/test`); управляется также через env `PW_LANG_NAME`.
- `--target playwright-test|javascript|python|python-async|python-pytest|csharp|csharp-mstest|csharp-nunit|csharp-xunit|java|java-junit` -- язык / test-runner. Значения `typescript` нет (для TS используется `playwright-test`).
- `-b firefox` / `--browser webkit` -- записать в конкретном движке (для проверки cross-browser-отличий); дефолт `chromium`.
- `--device "iPhone 13"` -- эмуляция мобильного viewport + user-agent.
- `--output tests/recorded.spec.ts` -- сохранить сразу в файл.
- `--save-storage auth.json` + `--load-storage auth.json` -- залогиниться один раз, переиспользовать сессию.

**Constraints:**

- Интерактивная команда. Открывает реальный браузер (headed) -- нужен GUI. В WSL без X-сервера / WSLg не запустится; на удалённом сервере проброс X11 / VNC обязателен.
- Codegen приоритизирует role-based locators (`getByRole`/`getByText`/`getByTestId`), но не вставляет web-first assertions -- их нужно добавить руками после записи. См. `dex-skill-playwright` про устойчивые локаторы и assertions.
- Запись открывает реальную сессию в URL: cookies, OAuth callback, формы -- всё уходит на сервер. Использовать staging-домены, не прод с реальными пользовательскими данными.
- `--save-storage` сохраняет cookies + localStorage -- этот файл содержит auth-токены, не коммитить, права 600.
