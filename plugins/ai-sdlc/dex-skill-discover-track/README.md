# dex-skill-discover-track

Трек обзорного ревью движка `dex-sdlc`. Трек-делегат: конвейер обзора ведёт `dex-code-discovery:discover-orchestrator`, трек принимает вход зоны, диспетчит оркестратор и принимает результат. Своего порядка фаз обзора не держит.

Вызывается движком `dex-sdlc:engine` - отдельно от него трек не запускается: движок ведёт цикл,
стоп-линию и возобновление, трек - порядок этой зоны.

## Фазы

- Phase 0: Intake & Scope - предмет обзора и границы
- Phase 1: Dispatch - `Agent` -> `dex-code-discovery:discover-orchestrator`, обрыв узла имеет свой терминал
- Phase 2: Result Intake - приёмка выхода оркестратора и handoff

## Вход

Команда: `/discover`.
