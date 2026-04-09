---
name: api-documentation
description: OpenAPI/Swagger — ловушки spec, генерации клиентов. Активируется при swagger, openapi, swashbuckle, nswag, Kiota, ProducesResponseType, XML comments, JsonStringEnumConverter, schema drift, api doc
---

# API Documentation — ловушки

> Ловушки контроллеров (ActionResult, CancellationToken, толстые контроллеры) — см. `dex-skill-api-development`
> Здесь: только OpenAPI/Swagger/NSwag/Kiota ловушки

## OpenAPI спецификация

### Schema drift — код и документация рассинхронизированы
Плохо: OpenAPI spec пишется вручную отдельно от кода
Правильно: генерация spec из кода (Swashbuckle/NSwag) или code-first + CI проверка
Почему: ручная spec устаревает после первого же рефакторинга. Клиенты генерируют код по старой spec → runtime ошибки

### Нет `[ProducesResponseType]` → Swagger показывает только 200
Плохо: endpoint возвращает 404, 422, 409, но Swagger показывает только 200 OK
Правильно: `[ProducesResponseType(typeof(ProblemDetails), 404)]` на каждый возможный статус
Почему: сгенерированные клиенты не обрабатывают 404/422 → необработанные ошибки в runtime

## XML Documentation

### GenerateDocumentationFile не включен
Плохо: написал `<summary>`, `<example>` на моделях, но Swagger их не показывает
Правильно: `<GenerateDocumentationFile>true</GenerateDocumentationFile>` в .csproj
Почему: без этого флага XML comments компилятором не генерируются. Swashbuckle молча их игнорирует — ни ошибки, ни предупреждения

### `<example>` отсутствует на request моделях
Плохо: `public record CreateProductRequest(string Name, decimal Price)` — Swagger показывает `"string"`, `0`
Правильно: XML `<example>` на каждом свойстве → Swagger показывает реалистичные значения
Почему: разработчик клиента копирует пример из Swagger. `"string"` → отправляет `"string"` как имя → баг

## Генерация клиентов (NSwag/Kiota)

### Сгенерированный клиент не в CI
Плохо: `nswag openapi2csclient` запускается вручную разработчиком
Правильно: генерация клиента в CI + diff-check (spec изменилась → клиент пересоздаётся)
Почему: spec обновили, клиент забыли перегенерировать → вызовы несуществующих endpoints, неправильные типы

### Enum как int в OpenAPI
Плохо: `"status": 2` — клиент получает число, не знает что значит
Правильно: `JsonStringEnumConverter` + `SchemaFilter` → `"status": "Approved"`
Почему: числовой enum ломает клиентов при изменении порядка. Добавление значения в середину enum сдвигает все числа

### Nullable не отражён в spec
Плохо: `string? MiddleName` генерируется как `required` в OpenAPI
Правильно: `SupportNonNullableReferenceTypes()` в Swashbuckle 6+ или `[Required]` explicit
Почему: клиент считает поле обязательным, отправляет пустую строку вместо null → некорректные данные

## Версионирование API документации

### Один Swagger doc на все версии
Плохо: v1 и v2 endpoints в одном Swagger UI → клиент не понимает что deprecated
Правильно: отдельный SwaggerDoc на каждую версию + `[ApiVersion]` + `[MapToApiVersion]`
Почему: клиенты v1 видят v2 endpoints, пробуют вызвать → 404 или неожиданный формат ответа

### Deprecated endpoints без пометки
Плохо: endpoint заменён новым, но старый без `[Obsolete]` → клиенты продолжают использовать
Правильно: `[Obsolete]` → Swagger показывает strikethrough + `deprecated: true` в spec
Почему: без пометки клиенты не мигрируют. Когда удалишь endpoint — массовый сбой

## Чек-лист

- `[ProducesResponseType]` на каждый возможный HTTP status
- `GenerateDocumentationFile` в .csproj
- XML `<example>` на request/response моделях
- Генерация клиентов в CI (NSwag/Kiota)
- Enum как string в OpenAPI (`JsonStringEnumConverter`)
- Отдельный SwaggerDoc per API version
- Deprecated endpoints помечены `[Obsolete]`
