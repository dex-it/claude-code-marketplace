# [снят] distributed-resilience: сжатие по свидетельству, группа 1.2

Скилл `dex-skill-distributed-resilience` 1.0.1
([`inputs/SKILL-1.0.1.md`](inputs/SKILL-1.0.1.md)), эпик #291, группа 1.2 (#294). Итог - скилл снят
целиком, строка в реестре [`tests/README.md`](../../../README.md).

Вход, исполнитель (`claude-sonnet-5-5`, effort medium, MCP нет), промпты и правило засчитывания -
общие для группы, в протоколе [solid](../../solid/README.md#заход-группы-12-2026-10-05). Со скиллом
прогонов нет: снятие по контролю. Кейсы A3 (ревью MR PayGate: Redis-баланс на трёх репликах,
`AddStandardResilienceHandler`, health-пробы) и D2 (проектирование оплаты с баланса Wallet: Wallet
медленный и лежит до получаса, ночная пачка автосписаний, три реплики). Выходы - в
[removed/microservices](../microservices/README.md) (`runs/a3-*`, `runs/d2-*`).

## Потребители

Skill tool в фазе: `architect` и `architect-dotnet` (Phase 4, «всегда»), `discover-reviewer`
(«если распределённая система»), `mr-reviewer`, `mr-check-reviewer`, `self-reviewer` (ось
`architecture`), `security-reviewer` (идемпотентность, replay). Тематическая строка `stack-registry`,
сноска «Отказ / откат» в `completeness-mapping`. Бандлы: `architect`, `code-review`,
`dotnet-developer`, `dotnet-fullstack`, `ts-fullstack`, `system-analyst`, `bug-lifecycle`. Кейс
активации `distributed-resilience-in`.

## Вердикт

| Ловушка 1.0.1 | Кейс | Контроль | Исход |
|---|---|---|---|
| Concurrent updates без CAS | A3 R-a, D2 R-a | 2/2: `GET` + `SET` баланса; 2/2: условный переход статуса | снята |
| Background job с lost update | A3 R-b | 2/2: сгорание баланса затирает пополнение | снята |
| Distributed lock как замена CAS | A3 R-c, D2 R-c | 2/2: лок только на списании, занятый лок - «недостаточно средств»; 2/2 | снята |
| Retry без idempotency | A3 R-d, D2 R-d | 2/2: POST повторяется стандартным обработчиком без `Idempotency-Key`; 2/2 | снята |
| Timeout не настроен | D2 R-e | 2/2: таймаут и исход «неизвестно» со сверкой по ключу | снята |
| Retry без exponential backoff и jitter | D2 R-f | 2/2 - ниже | снята |
| Retry без circuit breaker | D2 R-g | 2/2 | снята |
| Graceful degradation | D2 R-h, A3 M-b | 2/2: сбой чека не валит оплату; 2/2: синхронный Analytics в оплате | снята |
| Bulkheads не разделены | D2 R-i | 2/2: отдельный конвейер и лимит на Wallet, котировки FX изолированы | снята |
| Health check: liveness против readiness | A3 R-j | 2/2: Ledger и Redis в `live` | снята |

**R-f.** Ключ: повтор с нарастающей задержкой и разбросом, ночная пачка не бьёт Wallet синхронно.
Оба прогона контроля ставят `WalletClient` на `AddStandardResilienceHandler()` (ADR-0007) и
доигрывают неизвестный исход фоном по `next_attempt_at` с backoff; слово «разброс» не названо.
Засчитано по механизму, а не по слову: стандартный обработчик Microsoft.Extensions.Http.Resilience
повторяет с экспоненциальной задержкой и `UseJitter = true` по умолчанию (learn.microsoft.com,
«Build resilient HTTP apps», таблица «Standard resilience handler defaults»: Backoff `Exponential`, Use
jitter `true`; сверено 2026-10-05). Фоновое доигрывание по
`next_attempt_at` разброса не несёт - он не назван ни одним прогоном, вопрос в «Открыто».

**Health check.** Ловушка 1.0.1 держит три случая: liveness с зависимостями (R-j, 2/2), readiness с
необязательной зависимостью - Ledger в `ready` при ADR-0006 поднят обоими прогонами контроля (`a3-c1`
стр.23, `a3-c2` стр.27, major) без строки ключа, наблюдение; «ping без проверки зависимостей» в кейсе
не создан.

Числа 1.0.1 («1-5s», «3-5 retries») не сверены с документацией и в пункт не возвращаются - возвращать
нечего: ловушки сняты.

Приманка A3 PR (`AddStandardResilienceHandler` у клиентов по ADR-0007): ни один прогон не требует его
заменить; находка про идемпотентность POST - R-d, не P. В n2 (набор без этого скилла) все единицы R
- 2/2: сужения охвата нет.

## Открыто

- Разброс у фонового доигрывания (не HTTP-обработчик) и «ping без проверки зависимостей» кейсом не
  созданы.
- Дубль с `dex-skill-dotnet-resilience` (circuit breaker, retry с jitter) - группа 2.2 (#297); здесь
  не трогался. Kubernetes-пробы и observability - вне группы.
- `architect` и `architect-dotnet` грузили скилл «всегда» в Phase 4; загрузка снята целиком, как
  `owasp-security` в группе 1.1. Вопрос владельцу.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `distributed-resilience/SKILL.md` | 10103 байт, 63 строки | снят | 10 ловушек сняты |
| агенты, README, бандлы, `stack-registry`, `completeness-mapping`, витрина README | - | меньше | строки загрузки и ссылки на снятый скилл; в `completeness-mapping` «Отказ / откат» -> «дома нет, проверяй сам» |
| `tests/activation/cases.json` | `distributed-resilience-in` | снят | предмета нет |
