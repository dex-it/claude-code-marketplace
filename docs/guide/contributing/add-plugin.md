---
title: Добавить плагин
description: Какой вид плагина выбрать, как назвать, где разместить и что обязательно синхронизировать.
---

Короткая памятка. Полные правила - в [CLAUDE.md](https://github.com/dex-it/claude-code-marketplace/blob/main/CLAUDE.md) и [plugin-changes.md](https://github.com/dex-it/claude-code-marketplace/blob/main/.claude/rules/plugin-changes.md).

## 1. Выберите вид и имя

| Вид | Где лежит | Что внутри | Имя |
|---|---|---|---|
| Skill | `plugins/skills/` | `skills/<имя>/SKILL.md` | `dex-skill-{name}` |
| Специалист | `plugins/specialists/<категория>/` | `agents/<имя>.md`, при нужде `commands/<имя>.md` | `dex-{domain}-{role}` или `dex-{name}-specialist` |
| Утилита | `plugins/utilities/` | `hooks/` и (или) `commands/` | `dex-{name}` |
| Бандл | `plugins/bundles/` | `bundle.json` и `README.md` | `dex-bundle-{role}` |
| Мод | `mods/` (не `plugins/`) | `hooks/hooks.json` с ключом `modules`, TypeScript в `hooks/` | `dex-{name}` |

У каждого плагина есть `.claude-plugin/plugin.json` - манифест. Стековые skills несут префикс стека: `dex-skill-dotnet-ef-core`, `dex-skill-ts-nodejs-api`, `dex-skill-python-pytorch`.

Имя агента во frontmatter (`name`) - отдельная вещь: у стек-специфичного агента стек в имени (`dotnet-coder`), у общего - чистая роль (`debugger`).

## 2. Напишите плагин

Сначала прочитайте устройство вида: [Skill](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/SKILL_FRAMEWORK.md), [Agent](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/AGENT_FRAMEWORK.md), [Command](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/COMMAND_FRAMEWORK.md), [Mod](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/MOD_FRAMEWORK.md). Frontmatter skill несёт `name` и `description`; ключевые слова для автоматической активации включаются в `description`, отдельного поля `keywords` у skill нет.

## 3. Внесите в каталог

- Запись в `.claude-plugin/marketplace.json`: `name`, `source`, `description`, `version`, `category`, `keywords`. Значение `category` выводится из содержимого плагина, а не выбирается: `bundle.json` - `bundle`, `agents/` - `specialist`, `skills/` - `skill`, `hooks/hooks.json` с ключом `modules` - `mod`, `hooks/` или `commands/` - `utility`.
- Имя плагина в таблицах витрины `README.md`: иначе упадёт проверка.
- Версия самого каталога (`version` в `marketplace.json` и в подвале README) - minor вверх при добавлении плагина.
- Плагин входит в бандл - значит, обновите `bundle.json` и поднимите версию бандла. Бандл должен быть замкнут: всё, что названо компонентами, едет в нём же.

## 4. Проверьте

Прогоните [проверки](/contributing/checks/) и откройте [Pull Request](/contributing/pull-requests/).

:::tip[Если ссылаетесь на документы каталога]
Из текста артефакта (команды, агента, skill) на `docs/` каталога ссылаться нельзя: в установленный плагин `docs/` не входит. Из `README` плагина документ каталога адресуется абсолютным URL `https://github.com/dex-it/claude-code-marketplace/blob/main/...`, а не относительным путём.
:::
