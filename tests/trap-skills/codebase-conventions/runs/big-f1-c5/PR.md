# Shipping: расчёт стоимости доставки `POST /v1/shipments/{id}/quote`

Не собрано и не прогнано (в окружении нет `dotnet`): код проверен только чтением.

## Изменённые файлы

Новые:
- `libs/Meridian.Contracts/ShipmentQuotedIntegrationEvent.cs`
- `services/shipping/src/Meridian.Shipping/Application/Shipments/QuoteShipmentHandler.cs`
- `services/shipping/src/Meridian.Shipping/Domain/Errors.cs`
- `services/shipping/src/Meridian.Shipping/Domain/ShipmentQuote.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Carriers/CarrierRatesClient.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Carriers/CurrencyMinorUnits.cs`
- `PR.md`

Изменённые:
- `services/shipping/src/Meridian.Shipping/Api/ShipmentEndpoints.cs`
- `services/shipping/src/Meridian.Shipping/Domain/Shipment.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Persistence/ShippingDbContext.cs`
- `services/shipping/src/Meridian.Shipping/Modules/ShippingModule.cs`
- `services/shipping/src/Meridian.Shipping/Meridian.Shipping.csproj`
- `services/shipping/src/Meridian.Shipping/appsettings.json`

## Что делает изменение

`POST /v1/shipments/{id}/quote` запрашивает у перевозчика `GET /rates` (цена, валюта, срок), сохраняет котировку в отправлении
(`Shipment.Quote`: цена в минорных единицах, валюта, `etaDays`, `quotedAt`, `expiresAt = quotedAt + 24 ч`) и ставит в outbox
`ShipmentQuotedIntegrationEvent`. Котировка доступна, пока отправление в статусе `Created`; повторный запрос заменяет прежнюю.

Ответ 200: `{ shipmentId, priceMinor, currency, etaDays, expiresAt }`.
Ошибки - ProblemDetails с `code`: `shipping.shipment_not_found` (404), `shipping.quote_not_allowed` (409),
`shipping.concurrent_update` (409), `shipping.carrier_unavailable` (502), `shipping.carrier_bad_response` (502).

## Технические решения

- **Как Orders узнаёт о котировке: интеграционное событие через `IOutbox` + `IUnitOfWork`.** ADR-0021: прямой `IBus.PublishAsync`
  из хендлера не используется (старые хендлеры Shipping так делают - это долг, не образец). Имя по RUL-0011
  (`ShipmentQuotedIntegrationEvent`, без суффикса `Message`), в событии идентификаторы и факты (RUL-0013), деньги - `PriceMinor` + `Currency`
  (RUL-0009), время - `DateTimeOffset`. `ExpiresAt` в событии, чтобы Orders не считал срок сам. Сохранение и постановка в outbox - один `uow.CommitAsync`.
- **Бизнес-отказы - `Result<T>`, наследники `ShippingError`** (SHP-ADR-002), а не исключения; эндпоинт переводит их в ProblemDetails
  по типу (ADR-0020). Существующие хендлеры на исключениях не трогал - вне задачи.
- **Отдельный типизированный клиент `CarrierRatesClient`** (SHP-ADR-001), общий интерфейс не вводим. `CarrierTrackingClient` не менял.
- **Устойчивость HTTP - `AddStandardResilienceHandler`** с пределами из `Resilience:CarrierRates` (ADR-0026). Самописный цикл повторов
  из `CarrierTrackingClient` (REC-04), Polly-политики (ADR-0011, как в Payments) и `AddResilienceHandler` (ADR-0019) - заменены ADR, не копировал.
  Для этого добавлен пакет `Microsoft.Extensions.Http.Resilience` 8.10.0 (net8, ADR-0003). `GET /rates` безопасен для повтора.
  Отказ перевозчика (не-2xx, таймаут, открытый предохранитель, сетевая ошибка) - `CarrierUnavailableError`, 502.
- **Деньги.** Перевозчик отдаёт `price` как decimal; `decimal` остаётся только во внутреннем DTO клиента и сразу переводится в `Money`
  (RUL-0009) с округлением «от нуля» и учётом числа знаков валюты (`CurrencyMinorUnits`: 0/3 знака для известных валют, иначе 2).
  Некорректный ответ (нет валюты, отрицательная цена/срок, переполнение) - `CarrierBadResponseError`.
- **Время - `TimeProvider`** (ADR-0012), регистрируется `TryAddSingleton(TimeProvider.System)`. Срок жизни - `Shipment.QuoteLifetime` (24 ч) в домене.
- **Гонка с передачей перевозчику.** Вызов перевозчика долгий, за это время отправление могут передать или отменить. `Status` помечен как
  маркер конкурентности EF: сохранение котировки на изменившееся отправление даёт `DbUpdateConcurrencyException`, эндпоинт отвечает 409
  `shipping.concurrent_update`. Это дешевле и переносимее, чем отдельная колонка версии или блокировка на время вызова. Две параллельные
  котировки друг другу не мешают - выигрывает последняя, как и требует «заменяет прежнюю».
- **Хранение - owned-тип `ShipmentQuote`** в таблице отправлений (nullable-колонки), без отдельной таблицы: котировка всегда одна и принадлежит отправлению.
- **Идемпотентность** (ADR-0017): отдельный ключ не вводил - повтор не опасен, он просто заменяет котировку (ценой лишнего вызова перевозчика и ещё одного события).
  Потребитель события должен быть идемпотентным (RUL-0012). RUL-0005 (`Idempotency-Key`) - Proposed, не применял.
- **Идентификатор** в сигнатурах - `Guid`, как во всём существующем `Shipment`/репозитории; ADR-0006 требует типизированный id в новом коде,
  но `ShipmentId` потянул бы переписывание агрегата и репозитория - отдельной задачей.
- `AddShipping` теперь принимает `IConfiguration` (нужна секция `Resilience:CarrierRates`). Сейчас `Program.cs` не вызывает ни `AddShipping`,
  ни `MapShipments`, поэтому вызывающих кодов нет.

## Что не сделано / на ревью

- **Миграция БД не добавлена**: в репозитории миграций нет. Нужны колонки `Quote_*` в таблице отправлений (только вперёд, ADR-0015).
- **Потребитель в Orders не написан**: в Orders нет ни инфраструктуры подписки, ни поля для доставки у заказа. Публикуется только событие.
- **Реализации `IUnitOfWork`/`IOutbox` в репозитории не нашёл** (используются так же, как в `PlaceOrderHandler`); их регистрация - на стороне платформы.
- **Формат `from`/`to` для `/rates` в спеке не описан.** Передаю почтовый индекс (`Address.PostalCode`); подтвердить с перевозчиком
  (возможно, нужна страна или иной код).
- Срок действия не проверяется при передаче перевозчику (`HandOver`) - в задаче такого требования нет.
- Тесты не добавлял (RUL-0016: задача их не требует).
