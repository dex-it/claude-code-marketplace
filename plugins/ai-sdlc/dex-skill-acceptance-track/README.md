# dex-skill-acceptance-track

Трек зоны приёмки движка `dex-sdlc`. Приёмка слитой фичи на развёрнутом стенде против ТЗ: связывает образ стенда с merge-коммитом, проверяет требования пробами, ловит регрессию соседей, фальсифицирует находки и ведёт ремедиацию до повторной пробы.

Вызывается движком `dex-sdlc:engine` - отдельно от него трек не запускается: движок ведёт цикл,
стоп-линию и возобновление, трек - порядок этой зоны.

## Фазы

- Phase 0: Image-to-Code Binding - образ стенда против merge-коммита, расхождение останавливает трек
- Phase 1: Oracle & Probes - оракул из корпуса требований, план проб
- Phase 2: Run Probes - прогон через `dex-stand-reviewer:stand-reviewer`, read-only
- Phase 3: Neighbor Regression - соседи по карте потребителей
- Phase 4: Falsify Findings - каждая находка против кода
- Phase 5: Remediation & Re-probe - `dex-bug-fixer:bug-fixer`, повторная проба

## Вход

Команда: `/review-stand`.
