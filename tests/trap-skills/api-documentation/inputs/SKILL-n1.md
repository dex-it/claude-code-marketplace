---
name: api-documentation
description: OpenAPI/Swagger - ловушки spec, генерации клиентов. Активируется при swagger, openapi, swashbuckle, nswag, Kiota, ProducesResponseType, XML comments, JsonStringEnumConverter, schema drift, api doc
---

# API Documentation - чек-лист

Пункт называет ситуацию, которую документация API проверяет.

- Модели запросов без реалистичных примеров в схеме: клиент видит `"string"` и `0`
- Сгенерированный клиент не пересоздаётся и не сверяется при изменении схемы
- Один документ Swagger на несколько версий API
