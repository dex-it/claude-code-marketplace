# dex-bug-finder

Специалист активного поиска багов в работающей фиче или ветке, языко-агностично. Не дизайн тест-кейсов и не написание автотестов, а адверсариальная охота: атаковать риск и неявные предположения, воспроизвести найденное и передать в расследование.

## Агент

`bug-finder` (model opus) - шесть фаз: Scope & Stack Map, Risk Model & Charters, Direct Hunt, Skill-Based Deep Scan, Reproduce & Triage, Bug Report Handoff. Scope, воспроизведение и handoff обязательны.

## Команда

`/find-bugs <фича / ветка / область> [как запустить]` - тонкая обёртка над агентом.

## Место в цикле

Дополняет существующих QA-специалистов:

- `dex-test-analyst` - дизайн тест-кейсов (BVA, классы эквивалентности)
- `dex-test-automator` - автотесты (Playwright, Selenium, API)
- `dex-bug-reporter` - оформление найденного в баг-репорт

`bug-finder` ищет дефекты в первую очередь, до их фиксации в тест-кейсы, и отдаёт подтверждённые баги в handoff-контракт. Следующий шаг по подтверждённому багу - `dex-incident-investigator` (`/investigate`).

## Skills

Загружаются императивно по фазам: `dex-skill-exploratory-testing`, `dex-skill-bug-reproduction`, `dex-skill-contract-drift`, плюс `dex-skill-owasp-security`, `dex-skill-testability`, `dex-skill-test-design` по контексту.

## Установка

```bash
claude plugins install ./plugins/specialists/qa/dex-bug-finder
```

Идёт в составе `dex-bundle-bug-lifecycle` и `dex-bundle-qa-engineer`.
