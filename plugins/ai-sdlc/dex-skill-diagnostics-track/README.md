# dex-skill-diagnostics-track

Трек зоны диагностики движка `dex-sdlc`. Поиск первопричины по коду и уликам: спецификация симптома IS/IS-NOT, план опровержимых гипотез, сбор улик, фальсификация корреляций и handoff корня в ремедиацию.

Вызывается движком `dex-sdlc:engine` - отдельно от него трек не запускается: движок ведёт цикл,
стоп-линию и возобновление, трек - порядок этой зоны.

## Фазы

- Phase 0: Symptom & Access - IS/IS-NOT через `dex-skill-problem-specification`
- Phase 1: Hypothesis Plan - гипотеза, которую нечем опровергнуть, из плана убирается
- Phase 2: Collect Evidence - мутация состояния только по санкции `deploy`
- Phase 3: Falsify - корреляция против причинности
- Phase 4: Root Cause Handoff - корень и предлагаемая правка вызывающему

## Вход

Команда: `/root-cause, /investigate`.
