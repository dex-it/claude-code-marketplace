# ADR-0003: Повторы исходящих HTTP - политиками Polly

Статус: Accepted (2025-12-02)

## Решение

Типизированный HTTP-клиент регистрируется через `AddHttpClient<T>`; повторы на транзиентных
ошибках - `AddPolicyHandler(HttpPolicyExtensions.HandleTransientHttpError().WaitAndRetryAsync(...))`
(пакет `Microsoft.Extensions.Http.Polly`).
