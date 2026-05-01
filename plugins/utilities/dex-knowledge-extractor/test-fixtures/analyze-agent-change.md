# MR Analyze: dex/service-y !55

## Proposed agent changes

### dex-dotnet-reviewer: добавить проверку конфигов в Non-Code Artifacts Audit

**Целевой агент:** dex-dotnet-reviewer
**Фаза:** Non-Code Artifacts Audit

**Изменение:** в чек-лист Non-Code Artifacts Audit добавить пункт «проверить appsettings.*.json на захардкоженные секреты, дубли ConnectionString между средами, отсутствие appsettings.Production.json».

**Почему:** в проанализированном MR ревьюер указал на дубль ConnectionString в appsettings.Development.json и appsettings.Staging.json — это пропущено агентом, потому что фаза не упоминает приложенческие конфиги явно.
