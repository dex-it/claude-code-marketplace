---
name: dotnet-api-development
description: ASP.NET Core Web API - тонкий контроллер, тип и код ответа action, модель запроса, маршруты и параметры, enum в схеме Swagger. Активируется при ASP.NET Core, web api, controller, endpoint, REST, route, FromQuery, FromRoute, path, query parameter, ActionResult, CreatedAtAction, 201 Created, Location, ProducesResponseType, swagger, enum, DTO запроса
---

# ASP.NET Core Web API - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Бизнес-логика в action контроллера
- `IActionResult` вместо `ActionResult<T>`
- Создание ресурса отвечает 200 вместо 201 с `Location`
- Поле модели запроса, которое никто не читает
- Схема маршрутов нового контроллера расходится с соседними
- Путь целиком на каждом методе вместо `[Route]` на контроллере
- Обязательные идентификаторы ресурса в query вместо path
- Фильтры и пагинация в path вместо query
- Значения enum, близкие по смыслу, без описания в схеме API
- Ключ keyed-сервиса: одна константа на регистрацию и `[FromKeyedServices]`, не строка-литерал в каждом месте
