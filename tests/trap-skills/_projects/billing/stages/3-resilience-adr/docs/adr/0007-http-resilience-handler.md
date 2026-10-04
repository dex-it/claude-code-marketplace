# ADR-0007: Устойчивость исходящих HTTP - стандартным обработчиком Microsoft.Extensions.Http.Resilience

Статус: Accepted (2026-06-01). Заменяет ADR-0003.

## Решение

Типизированный HTTP-клиент регистрируется через `AddHttpClient<T>` с
`.AddStandardResilienceHandler()` (пакет `Microsoft.Extensions.Http.Resilience`): повторы,
таймауты попытки и запроса, circuit breaker - одним конвейером. `AddPolicyHandler` в новом коде не
используется.

## Почему

`Microsoft.Extensions.Http.Polly` устарел; v7-политики не дают таймаута попытки и circuit breaker
без ручной сборки, у каждого клиента своя россыпь настроек.

## Последствия

`FxRatesClient` остаётся на `AddPolicyHandler` до своей следующей правки - тогда переводится.
