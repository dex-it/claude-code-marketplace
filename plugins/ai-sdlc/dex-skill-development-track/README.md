# dex-skill-development-track

Трек зоны разработки движка `dex-sdlc`: ведёт путь «ТЗ или тикет (в т.ч. без спеки) -> дизайн ->
edit-план -> реализация с TDD -> coverage-гейт» до серии локальных коммитов без push.

## Состав

| Артефакт | Что делает |
|---|---|
| Skill `development-track` | 9 фаз (0-8), гейт первоисточника, ADR pre-check, coverage-гейт, саморевью зоны узлом `self-reviewer` |

Вызывается движком `dex-sdlc:engine` - трек не запускается отдельно от него: движок ведёт цикл,
стоп-линию и возобновление, трек - порядок этой зоны.

## Как работает

```
вход (ТЗ / тикет / "почини это", спека не обязательна)
  |
  v
Phase 0: Project Conventions
  |
  v
Phase 1: Decompose Spec -> R/I, под-вид (фича/баг-фикс/рефакторинг), режим теста
  |
  v
Phase 2: Architecture Inventory (4 блока: Touchpoints/Reuse/Neighbor patterns/Contracts)
  |
  v
Phase 3: Research Unknowns (опционально)
  |
  v
Phase 4: Design                         гейт первоисточника + ADR pre-check
  |
  v
Phase 5: Executable Edit Plan -> P1..Pn
  |
  v
Phase 6: Falsify Plan
  |
  v
Phase 7: Implement with Verify          coder-узел под стек на каждую правку, коммит трека
  |
  v
Phase 8: Final Self-Verification        coverage-гейт, tester-узел на добор
  |
  v
Саморевью зоны                          узел self-reviewer, отчёт наверх
  |
  v
локальные коммиты, push не сделан -> /self-review (цикл с автором перед push)
```

## Кто пишет код

Трек не пишет production-код сам: Phase 7 раскладывается на профильный coder-узел под стек манифеста
(`dex-dotnet-coder`, `dex-ts-fullstack-coder` и т.п.), добор покрытия - на tester-узел, саморевью
зоны - на `dex-self-reviewer`: состав осей узел выводит картой изменений и по каждой отчитывается,
активна она или нет. Планирование, инвентаризация, дизайн, фальсификация плана и финальная
верификация - работа трека (`channel: self`).

## Под-виды

Классифицируются в Phase 1, каждый со своим тест-DoD: фича (полная матрица покрытия + регресс
потребителей), баг-фикс (деталь процедуры - `dex-skill-bugfix-track:bugfix-track`), рефакторинг
(safety-net тесты, неизменные assert'ы).

## Использование

Напрямую не вызывается - через команду движка:

```
/implement                                # ТЗ или тикет запрашивается в диалоге
/implement личный кабинет с экспортом отчётов
/implement PROJ-1234                      # тикет без развёрнутой спеки - штатный вход
```
