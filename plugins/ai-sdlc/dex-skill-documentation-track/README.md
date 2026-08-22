# dex-skill-documentation-track

Трек зоны документации движка `dex-sdlc`. Документация с проверкой фактов по коду: жанр и стандарт до письма, факты из кода, черновик профильным узлом, сверка со статусом каждого утверждения и размещение в дереве проекта.

Вызывается движком `dex-sdlc:engine` - отдельно от него трек не запускается: движок ведёт цикл,
стоп-линию и возобновление, трек - порядок этой зоны.

## Фазы

- Phase 0: Audience, Genre & Standard - жанр, аудитория, чеклист стандарта
- Phase 1: Facts from Code - утверждения берутся из кода, не из памяти
- Phase 2: Draft - `dex-doc-writer`, `dex-adr-writer` или `dex-diagram-creator` по жанру
- Phase 3: Verify Sync - статус каждого утверждения: `verified` / `unverifiable` / `contradicted`
- Phase 4: Self-Review & Placement - саморевью и место в дереве документации

## Вход

Команда: `/documentation`.
