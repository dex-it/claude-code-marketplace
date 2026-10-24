---
title: Как внести вклад
description: Как добавить плагин или поправить существующий - путь изменения от ветки до Pull Request и где лежат правила.
---

Каталог растёт плагинами. Если вы хотите добавить плагин или поправить существующий, начните с правил разработки: они лежат рядом с кодом и проверяются валидаторами.

## Путь изменения

1. Форкните репозиторий и создайте ветку от `develop`.
2. Прочитайте устройство того, что правите: [skill](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/SKILL_FRAMEWORK.md), [агент](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/AGENT_FRAMEWORK.md), [команда](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/COMMAND_FRAMEWORK.md), [мод](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/MOD_FRAMEWORK.md).
3. Внесите изменение и синхронизируйте всё, что нужно: [Добавить плагин](/contributing/add-plugin/), [Версии](/contributing/versions/).
4. Прогоните [проверки](/contributing/checks/).
5. Откройте Pull Request в `develop`: [Pull Request](/contributing/pull-requests/).

## Где лежат правила

Нормативные тексты лежат в репозитории, а не на этом сайте: сайт их пересказывает и ведёт к первоисточнику.

| Документ | О чём |
|---|---|
| [CLAUDE.md](https://github.com/dex-it/claude-code-marketplace/blob/main/CLAUDE.md) | Как писать плагины, ревьюить и проверять перед коммитом |
| [plugin-changes.md](https://github.com/dex-it/claude-code-marketplace/blob/main/.claude/rules/plugin-changes.md) | Версии (semver), обязательные синхронизации, гейт перед коммитом |
| [docs-changes.md](https://github.com/dex-it/claude-code-marketplace/blob/main/.claude/rules/docs-changes.md) | Правки документации |
| [terminology.md](https://github.com/dex-it/claude-code-marketplace/blob/main/.claude/rules/terminology.md) | Заведённые имена; значения - в [словаре](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/domain/domain-model.md) |
| [VALIDATOR_RULES.md](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/VALIDATOR_RULES.md) | Реестр правил валидаторов: что ловит каждое |
| [BRD](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/product/brd.md), [конституция](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/domain/constitution.md) | Ценность и инварианты каталога |

Остальные документы раздела `docs/` (корпус, карта процесса разработки, стандарты, конвейеры) перечислены в [README репозитория](https://github.com/dex-it/claude-code-marketplace#участие). В установленный плагин они не входят: это правила для авторов, а не рантайм.

## Принципы, которые стоит знать до первой правки

- **Skill - ловушки, а не документация.** Если «убрать имена проекта - правило всё ещё читается», оно обобщено верно.
- **Агент описывается фазами-контрактами, а не процедурами:** цель, результат, критерий завершения.
- **Один факт - один дом.** Правило не копируется, а даётся ссылкой на дом.
- **Тексты артефактов пишутся для модели:** сухо и по делу, без пересказа.
