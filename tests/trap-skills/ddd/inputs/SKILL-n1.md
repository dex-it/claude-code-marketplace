---
name: ddd
description: DDD - ловушки aggregate, entity, value object. Активируется при DDD, domain driven, aggregate, value object, domain event, bounded context, anemic model, domain service, specification, invariant, ubiquitous language, persisted state
---

# DDD - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Переход состояния сущности вне её методов
- Репозиторий для дочерней сущности агрегата
- Коллекция агрегата, растущая без границы
- Хранимое поле без читателя или выводимое из соседних полей
- Имя поля контракта по ветке реализации, а не по значению
- Обобщённые имена в контракте (`Id`, `Value`, `Date`) вместо доменных
- Имена внешнего API в доменной модели
- Несколько агрегатов в одной транзакции
- Один `DbContext` на все ограниченные контексты
- Specification для простого запроса
