---
name: api-testing
description: Интеграционные тесты HTTP API - база тестов против базы эксплуатации, когда проверяемое поведение держит сама база (ограничения, конкурентность, транзакции). Активируется при api testing, integration test, WebApplicationFactory, Testcontainers, InMemoryDatabase, UseInMemoryDatabase, Sqlite в тестах, тестовая база, contract testing
---

# API Testing - чек-лист

Пункт называет ситуацию, которую тесты API проверяют.

- API-тесты на подменной базе (EF InMemory, Sqlite), когда проверяемое поведение держит настоящая база: ограничения, конкурентность, транзакции
