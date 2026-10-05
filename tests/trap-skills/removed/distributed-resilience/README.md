# [снят] distributed-resilience: сжатие по свидетельству, группа 1.2

Скилл `dex-skill-distributed-resilience` 1.0.1
([`inputs/SKILL-1.0.1.md`](inputs/SKILL-1.0.1.md)), эпик #291, группа 1.2 (#294). Итог - скилл снят
целиком; R-f (повтор без разброса) по ревью PR #316 возвращена названием в Phase 4 `architect` и
`architect-dotnet`. Строка в реестре [`tests/README.md`](../../../README.md).

Вход, исполнитель (`claude-sonnet-5-5`, effort medium, MCP нет), промпты и правило засчитывания -
общие для группы, в протоколе [solid](../../solid/README.md#заход-группы-12-2026-10-05). Со скиллом
прогонов нет: снятие по контролю. Название R-f мерилось набором `r1` - редакции n2 `ddd` и
`clean-architecture` (загрузка `architect`) плюс строка Failure modes с названием
([`inputs/ARCHITECT-named.md`](inputs/ARCHITECT-named.md)); `claude -p` 2.1.289, выходы - `runs/`. Кейсы A3 (ревью MR PayGate: Redis-баланс на трёх репликах,
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
| Concurrent updates без CAS | A3 R-a, D2 R-a | 2/2: `GET` + `SET` баланса; 5/5: условный переход статуса | снята |
| Background job с lost update | A3 R-b | 2/2: сгорание баланса затирает пополнение | снята |
| Distributed lock как замена CAS | A3 R-c, D2 R-c | 2/2: лок только на списании, занятый лок - «недостаточно средств»; 5/5 | снята |
| Retry без idempotency | A3 R-d, D2 R-d | 2/2: POST повторяется стандартным обработчиком без `Idempotency-Key`; 5/5 | снята |
| Timeout не настроен | D2 R-e | 5/5: таймаут и исход «неизвестно» со сверкой по ключу | снята |
| Retry без exponential backoff и jitter | D2 R-f | **1/5** - ниже | возвращена названием |
| Retry без circuit breaker | D2 R-g | 5/5 | снята |
| Graceful degradation | D2 R-h, A3 M-b | 5/5: сбой чека не валит оплату; 2/2: синхронный Analytics в оплате | снята |
| Bulkheads не разделены | D2 R-i | 5/5: отдельный конвейер и лимит на Wallet, котировки FX изолированы | снята |
| Health check: liveness против readiness | A3 R-j | 2/2: Ledger и Redis в `live` | снята |

**Прогоны D2.** По записи в ключе billing после ревью PR #316 каждая единица D2 судится по всем
прогонам контроля `d2-c1` - `d2-c5`, а не парой `d2-c1`, `d2-c2`. R-a, R-c, R-d, R-e, R-g, R-h, R-i -
5/5; M-h, M-i, M-j - в [removed/microservices](../microservices/README.md).

**R-f.** Ключ: повтор с нарастающей задержкой и разбросом, ночная пачка не долбит Wallet синхронно.
Первый вердикт засчитал R-f по механизму HTTP-обработчика: `AddStandardResilienceHandler`
повторяет с экспоненциальной задержкой и `UseJitter = true` по умолчанию (learn.microsoft.com,
«Build resilient HTTP apps», таблица «Standard resilience handler defaults»; сверено 2026-10-05).
Ревью PR #316 его снимает: обработчик задан ADR-0007, исполнитель его не выбирал, а его повторы идут
секундами внутри одного вызова, тогда как Wallet лежит минутами. R-f судится по фоновому доигрыванию
(запись в ключе billing):

| Прогон | Фоновый повтор | R-f |
|---|---|---|
| `d2-c1` | `next_attempt_at` по backoff, разброса нет | 0 |
| `d2-c2` | `next_attempt_at` по backoff, разброса нет | 0 |
| `d2-c3` | фиксированный ряд 1, 2, 5, 15, 30 мин; HTTP-повторы 0-1 | 0 |
| `d2-c4` | нарастающая пауза воркера 30 с - 5 мин, разброса нет | 0 |
| `d2-c5` | экспоненциальный backoff и jitter по `next_attempt_at` (стр.99) | 1 |

Контроль - 1/5 (пара 0/2). Лимит параллелизма и пауза пачки при открытом размыкателе судятся
строками R-i и R-g. В n2 (набор без этого скилла) по той же сверке - 1/2: `d2-n2a`
называет джиттер, `d2-n2b` - только нарастающую паузу.

Возврат - шаг 1 «Формы пункта», название в Failure modes Phase 4 `architect` и `architect-dotnet`:
«фоновые повторы пачки к соседу после его простоя без разброса задержки». Набор `r1`: D2 - 2/2
(`d2-r1a` стр.174-177: возобновление со случайной задержкой и медленным стартом, повторы
растягиваются случайным сдвигом аренды; `d2-r1b` стр.198-205: экспоненциальная пауза с full jitter).
Остальные единицы D2 в `r1` - 2/2. Задетые кейсы D1, D3 по одному прогону (`d1-r1a`, `d3-r1a`):
единицы `microservices` взяты все, название применено к повторам агентства (D1) и CRM (D3) без
ложного решения.

**Health check.** Ловушка 1.0.1 держит три случая: liveness с зависимостями (R-j, 2/2), readiness с
необязательной зависимостью - Ledger в `ready` при ADR-0006 поднят обоими прогонами контроля (`a3-c1`
стр.23, `a3-c2` стр.27, major) без строки ключа, наблюдение; «ping без проверки зависимостей» в кейсе
не создан.

Числа 1.0.1 («1-5s», «3-5 retries») не сверены с документацией и в пункт не возвращаются - возвращать
нечего: ловушки сняты.

Приманка A3 PR (`AddStandardResilienceHandler` у клиентов по ADR-0007): ни один прогон не требует его
заменить; находка про идемпотентность POST - R-d, не P. В n2 (набор без этого скилла) единицы R,
кроме R-f, - 2/2: сужения охвата нет.

## Открыто

- «Ping без проверки зависимостей» кейсом не создан.
- Дом названия R-f - агенты `architect`, `architect-dotnet` (Failure modes Phase 4), решение ревьюера
  в треде PR #316: в `dotnet-resilience` (#297) не переносится - там повторы HTTP-клиента, а фоновое
  доигрывание пачки после простоя соседа - другая ситуация; ситуация стек-нейтральна, а
  из двух архитекторов `dotnet-resilience` грузит только `architect-dotnet`.
- Дубль с `dex-skill-dotnet-resilience` (circuit breaker, retry с jitter) - группа 2.2 (#297); здесь
  не трогался. Kubernetes-пробы и observability - вне группы.
- `architect` и `architect-dotnet` грузили скилл «всегда» в Phase 4; загрузка снята целиком, как
  `owasp-security` в группе 1.1. Решение владельца (05.10.2026): принято - снятый скилл не
  грузится; resilience .NET остаётся у `dotnet-resilience` (#297). R-f возвращена названием в
  Phase 4 тех же агентов, загрузка скилла не возвращается.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `distributed-resilience/SKILL.md` | 10103 байт, 63 строки | снят | 10 ловушек сняты |
| агенты, README, бандлы, `stack-registry`, `completeness-mapping`, витрина README | - | меньше | строки загрузки и ссылки на снятый скилл; в `completeness-mapping` «Отказ / откат» -> «дома нет, проверяй сам» |
| `architect.md`, `architect-dotnet.md`, Failure modes Phase 4 | 17047 и 17578 символов | 17119 и 17652 | название R-f (+72 и +74 с переносом) |
| `tests/activation/cases.json` | `distributed-resilience-in` | снят | предмета нет |
