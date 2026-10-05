# ADR-0003: Повторы исходящих HTTP - политиками Polly

Статус: Superseded by ADR-0007 (2026-06-01)

## Решение

Типизированный HTTP-клиент регистрируется через `AddHttpClient<T>`; повторы на транзиентных
ошибках - `AddPolicyHandler(HttpPolicyExtensions.HandleTransientHttpError().WaitAndRetryAsync(...))`
(пакет `Microsoft.Extensions.Http.Polly`).
