# dex-skill-mr-review-track

Трек ревью входящего MR движка `dex-sdlc`. Ревью чужого MR/PR: намерение автора до чтения диффа, фан-аут по осям, активным для diff (`language`, `architecture`, `business`, `regressions`, `security`, `performance`), с отдельным узлом на `security`, покрытие тестами отдельным фокусом, фальсификация каждой находки и публикация тредов по санкции.

Вызывается движком `dex-sdlc:engine` - отдельно от него трек не запускается: движок ведёт цикл,
стоп-линию и возобновление, трек - порядок этой зоны.

## Фазы

- Phase 0: Intake & Intent - предмет, SHA, намерение автора
- Phase 1: Review Fan-out - `dex-mr-reviewer` плюс `dex-security-reviewer` отдельным узлом
- Phase 2: Coverage Focus - покрытие тестами как отдельный фокус
- Phase 3: Falsify - каждая находка против кода; ответ автора - claim, не факт
- Phase 4: Publish Threads - публикация в чужой MR по полю `publish`, не по режиму
- Phase 5: Revision Close - вердикт ревизии и переход к ре-ревью дельты

## Вход

Команда: `/mr-review`.
