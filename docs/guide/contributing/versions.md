---
title: Версии
description: Как поднимать версию плагина и каталога по semver и что синхронизировать между plugin.json и marketplace.json.
---

Версии плагинов - semver. Что за какой подъём отвечает, зависит от изменения:

| Изменение | Подъём |
|---|---|
| Новый плагин | `1.0.0` |
| Новый плагин в каталоге | minor версии каталога |
| Изменён состав бандла | minor бандла |
| Переименование плагина | major |
| Ломающее изменение workflow или формата выхода агента | major |
| Новые ловушки в skill, новая категория ловушек | minor |
| Правка `description`, ключевых слов, опечатка | patch |

Это краткая выдержка; полная таблица - в [plugin-changes.md](https://github.com/dex-it/claude-code-marketplace/blob/main/.claude/rules/plugin-changes.md#версионирование-при-изменениях-semver).

## Две версии одного плагина

Версия плагина живёт в двух файлах: `.claude-plugin/plugin.json` и `.claude-plugin/marketplace.json`. Они обновляются одновременно. Расхождение ловит `npm run validate` (правило `version-mismatch`).

`description` тоже хранится в двух местах, но дом у него один - `plugin.json`. Запись в `marketplace.json` генерируется:

```bash
npm run sync:marketplace            # записать версии и описания в marketplace.json
npm run sync:marketplace -- --check # только показать расхождения
```

## Версия каталога

Верхнеуровневое `version` в `marketplace.json` - отдельный счётчик. Он растёт при добавлении или удалении плагина и дублируется в подвале `README.md`; расхождение ловит проверка `readme-version-drift`.

## Снять или переименовать плагин

Установщики снятые плагины не удаляют, поэтому снятие или переименование требует строки в таблице `Renamed and removed plugins` файла [install-bundle/README.md](https://github.com/dex-it/claude-code-marketplace/blob/main/install-bundle/README.md) тем же Pull Request.
