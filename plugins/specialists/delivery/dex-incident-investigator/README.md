# dex-incident-investigator

Специалист расследования инцидентов и поиска корневой причины на общем стенде, языко-агностично. Кодифицирует методологию расследования: спецификация проблемы, сбор улик, доказанная причинно-следственная цепочка, фикс на источнике.

## Агент

`incident-investigator` (model opus) - восемь фаз: Access & Map, Problem Specification (IS/IS-NOT), Parallel Evidence, Hypotheses & Chain, Falsification, Fix Plan, Report, Gated Fix. Режим по умолчанию - только чтение; фикс под gate `фиксируй`.

## Команда

`/investigate <описание инцидента> [ветка стенда]` - точка входа команды в `dex-sdlc`, не в этом плагине. Команда вызывает движок `dex-sdlc:engine` и трек `dex-skill-diagnostics-track:diagnostics-track`, который делегирует расследование этому агенту. Циклы: `оформляй` (полный отчёт), `фиксируй` (фикс по одной проблеме), `стоп`.

## Делегирование стенда

Сбор улик со стенда идёт read-only через существующие инфра-плагины, без дублирования:

- Под и события, логи, ресурсы - `dex-kubectl-cli`
- Мерджи, пайплайны, джоб-логи - `dex-gitlab-cli` / `dex-github-cli`, билды - `dex-teamcity-cli`
- Метрики Prometheus и трейсы Tempo - `dex-monitoring-grafana`, структурные логи - `dex-logging-seq`, error-tracking - MCP-сервер `sentry`
- Связанные тикеты и история задачи - `dex-jira-cli`

## Skills

Загружаются императивно по фазам: `dex-skill-problem-specification`, `dex-skill-root-cause-analysis`, `dex-skill-change-correlation`, `dex-skill-shared-stand-safety`, `dex-skill-contract-drift`, плюс `dex-skill-observability` и `dex-skill-owasp-security` по контексту.

## Установка

```bash
claude plugins install ./plugins/specialists/delivery/dex-incident-investigator
```

Идёт в составе `dex-bundle-bug-lifecycle` и `dex-bundle-code-review`.
