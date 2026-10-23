---
title: Проверки перед коммитом
description: Валидаторы и тесты каталога, что запускать локально и что проверяет CI.
---

Нужны Node.js 22.6 или новее и `npm install` в корне репозитория.

| Команда | Что проверяет |
|---|---|
| `npm run validate` | Все валидаторы подряд: агенты, skills, команды, бандлы, витрина README, словарь имён, типы модов. Должно быть 0 ошибок |
| `npm test` | Сами правила валидаторов на фикстурах с заведомым дефектом |
| `npm run test:tools` | Тесты инструментов в `tests/tools/` |
| `npm run sync:marketplace -- --check` | Расхождения `description` и `version` между `plugin.json` и `marketplace.json` |
| `npm run test:mods` | Тесты модов |
| `npm run test:hooks`, `npm run test:tracks` | Хуки и треки `dex-auto` |

Проверки строгие, мягкого режима нет. `npm run validate` и `npm test` дополняют друг друга: первый гоняет правила на живом каталоге, где они должны молчать, второй - на фикстурах, где дефект заведомо есть.

## CI

На каждый Pull Request GitHub Actions повторяет локальный гейт отдельными шагами по каждому валидатору, чтобы при падении было видно, какой именно сработал. Описание правил - в [VALIDATOR_RULES.md](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/VALIDATOR_RULES.md) и [tools/README.md](https://github.com/dex-it/claude-code-marketplace/blob/main/tools/README.md), фикстуры и прогоны - в [tests/README.md](https://github.com/dex-it/claude-code-marketplace/blob/main/tests/README.md).

Валидатор судит форму файлов. Что он не видит, проверяется вручную: обобщённость ловушки, отсутствие документации API в skill, имя skill в ссылке.

## Проверка сайта документации

Сам этот сайт собирается отдельной проверкой на Pull Request, который трогает `docs/guide/`, `site/` или данные каталога. Локально: `cd site && npm ci && npm run build`. Подробнее: [Редактировать этот сайт](/contributing/docs-site/).
