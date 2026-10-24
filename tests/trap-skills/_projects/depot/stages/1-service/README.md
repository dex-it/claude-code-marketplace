# Depot

Сервис складского учёта (остатки по SKU и складам). `src/Depot.Api` - HTTP API, `src/Depot.Contracts` - DTO
(их использует клиентская библиотека, в том числе под Windows), `tests/Depot.Api.Tests` - тесты (категории
`Contracts` и `Integration`; интеграционным нужен Postgres через Testcontainers, то есть Docker).
Эксплуатационные сведения - `docs/runbook.md`.
