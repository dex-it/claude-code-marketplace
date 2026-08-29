# dex-stand-reviewer

Специалист приёмки слитой фичи на развёрнутом стенде против ТЗ, языко-агностично, read-only. Кодифицирует принцип "зелёный деплой не равно рабочая фича": статус "работает" даёт только наблюдаемое поведение на стенде, подтверждённое логом, трейсом, метрикой или sha.

## Агент

`stand-reviewer` (model opus) - восемь фаз: Access & Deploy Binding, Domain Priming & Scope, Stand Probe Plan, Parallel Stand Hunt, Non-Code Artifacts Audit, Fact Verification & Falsification, Cross-Linking & Calibration, Report. Режим только чтение; фиксов нет - подтверждённые находки уходят в `dex-bug-fixer`.

## Команда

`/review-stand <ТЗ или ссылка на тикет/MR> [ветка стенда]` - точка входа команды в `dex-sdlc`, не в этом плагине. Команда вызывает движок `dex-sdlc:engine` и трек `dex-skill-acceptance-track:acceptance-track`, который делегирует приёмку этому агенту, а ремедиацию найденного - `dex-bug-fixer`.

## Делегирование стенда

Сбор улик со стенда идёт read-only через существующие инфра-плагины, без дублирования:

- Поды, события, логи, ресурсы, реально запущенный образ - `dex-kubectl-cli`
- MR/PR, пайплайны, джоб-логи - `dex-gitlab-cli` / `dex-github-cli`, билды - `dex-teamcity-cli`
- Метрики Prometheus, трейсы Tempo, логи Loki - `dex-monitoring-grafana`, структурные логи - `dex-logging-seq`, error-tracking - MCP-сервер `sentry`
- ТЗ, тикеты, критерии приёмки - `dex-jira-cli`

## Skills

Загружаются императивно по фазам: `dex-skill-shared-stand-safety`, `dex-skill-stand-verification` (включая дисциплину временных E2E), `dex-skill-codebase-conventions`, `dex-skill-completeness-mapping`, `dex-skill-change-correlation`, `dex-skill-review-evidence`, `dex-skill-fact-verification`, `dex-skill-requirement-quality`, `dex-skill-no-loose-ends`, `dex-skill-output-hygiene`, плюс by-stack skills по реестру и `dex-skill-owasp-security` / `dex-skill-contract-drift` / `dex-skill-observability` по контексту.

## Установка

```bash
claude plugins install ./plugins/specialists/review/dex-stand-reviewer
```

Идёт в составе `dex-bundle-bug-lifecycle`.
