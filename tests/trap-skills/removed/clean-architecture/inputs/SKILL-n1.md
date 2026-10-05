---
name: clean-architecture
description: Clean Architecture — ловушки слоёв, зависимостей, транзакций. Активируется при clean architecture, onion, hexagonal, dependency rule, IQueryable, Domain layer, Application layer, MediatR, IUnitOfWork, IRepository, Feature Slice, God DbContext
---

# Clean Architecture - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Папка-на-слой при многих сценариях вместо среза по фиче
- Циклическая ссылка между проектами слоёв
- Общий проект Shared/Common, на который ссылаются все слои
- Бизнес-логика, проверяемая только через HTTP
- Узкий метод репозитория рядом со specification-базой, выражающей тот же сценарий
