# ADR-0002: Исходящие HTTP-вызовы

Статус: Accepted, 2026-09-01

## Контекст

Сервис зовёт внешние HTTP API (Supplier API). Нужен единый способ регистрации клиентов.

## Решение

Каждый внешний API - typed `HttpClient` в `Pricing.Infrastructure`, регистрируется в
`InfrastructureModule` через `AddHttpClient<TClient>` и подключает
`AddStandardResilienceHandler()` (Microsoft.Extensions.Http.Resilience). Настройки клиента -
секция конфигурации с именем системы.
