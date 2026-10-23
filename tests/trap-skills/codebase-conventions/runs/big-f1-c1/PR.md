# Shipping: расчёт стоимости доставки (`POST /v1/shipments/{id}/quote`)

## Изменённые файлы

Новые:
- `libs/Meridian.Contracts/ShipmentQuotedIntegrationEvent.cs`
- `services/shipping/src/Meridian.Shipping/Domain/Errors.cs`
- `services/shipping/src/Meridian.Shipping/Domain/ShipmentQuote.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Carriers/CarrierRatesClient.cs`
- `services/shipping/src/Meridian.Shipping/Application/Shipments/QuoteShipmentHandler.cs`
- `services/shipping/src/Meridian.Shipping/Api/ShippingProblems.cs`

Изменённые:
- `services/shipping/src/Meridian.Shipping/Domain/Shipment.cs` - свойство `Quote`, метод `ApplyQuote`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Persistence/ShippingDbContext.cs` - маппинг котировки, токен конкурентности
- `services/shipping/src/Meridian.Shipping/Api/ShipmentEndpoints.cs` - эндпоинт и `QuoteResponse`
- `services/shipping/src/Meridian.Shipping/Modules/ShippingModule.cs` - регистрация клиента и хендлера
- `PR.md`

## Что делает

`POST /v1/shipments/{id}/quote` берёт отправление, запрашивает у перевозчика `GET /rates` (вес, откуда, куда),
сохраняет котировку в отправлении (цена в минорных единицах, валюта, срок в днях, `quotedAt`, `expiresAt` = +24 ч)
и кладёт в outbox `ShipmentQuotedIntegrationEvent`. Orders узнаёт о котировке из этого события.
Ответ 200: `{ priceMinor, currency, etaDays, quotedAt, expiresAt }`.

Ошибки - ProblemDetails с `code`: `shipping.not_found` (404), `shipping.quote_not_allowed` (409),
`shipping.carrier_unavailable` (502).

## Решения

- **Результат ошибкой-значением, не исключением.** `Result<ShipmentQuote>` и наследники `ShippingError` (SHP-ADR-002),
  эндпоинт переводит их в ProblemDetails по типу (ADR-0020). Старые хендлеры с исключениями не трогал: вне задачи.
- **Котировка доступна только в статусе `Created`.** «Пока не передано перевозчику» = `Created`; `Cancelled` тоже
  отклоняется (цена для отменённого бессмысленна). Проверка и в хендлере (чтобы не звать перевозчика зря - отказ значением),
  и в `Shipment.ApplyQuote` (инвариант; там исключение как защита от ошибки программиста).
- **Повторный запрос заменяет котировку** (одна запись `Quote` у отправления, история не хранится). Операция естественно
  идемпотентна, ключ запроса не нужен (ADR-0017); `Idempotency-Key` (RUL-0005) - Proposed, не вводил.
- **Срок действия - поле `ExpiresAt`, вычисленное при создании** (`ShipmentQuote.Lifetime` = 24 ч), время из `TimeProvider`
  (ADR-0012). Просроченность не хранится флагом, потребитель сравнивает с текущим временем. Принудительной проверки
  срока при передаче перевозчику нет: в поручении её не было.
- **Деньги.** Перевозчик отдаёт `decimal` в единицах валюты; он преобразуется в `long` минорных единиц внутри
  `CarrierRatesClient` (округление от нуля; знаков валюты 0/2/3 по ISO 4217), дальше везде `Money`/`long` + `Currency`
  (RUL-0009) - в БД, ответе и событии. Некорректный ответ (нет цены/валюты/срока, отрицательные значения) = недоступность перевозчика.
- **Хранение.** Owned-тип `ShipmentQuote` в той же таблице, колонки nullable. Миграций в репозитории нет (каталога миграций у Shipping
  нет), поэтому файл миграции не добавлен; при появлении схемы нужна миграция «вперёд» (ADR-0015).
- **Событие через outbox, не `IBus`.** `IOutbox.EnqueueAsync` + `IUnitOfWork.CommitAsync` в одной единице работы (ADR-0021;
  ADR-0009 и REC-07 заменены). Имя `ShipmentQuotedIntegrationEvent` (RUL-0011), в нём идентификаторы и факты, деньги - `long` + валюта
  (RUL-0013, RUL-0009). Консьюмер идемпотентен по `EventId` (RUL-0012). Старые `ShipmentCreatedMessage` и др. не менял.
- **Клиент перевозчика - отдельный типизированный `CarrierRatesClient`** без общего интерфейса (SHP-ADR-001), устойчивость -
  `AddStandardResilienceHandler()` (ADR-0026). Самописный цикл повторов из `CarrierTrackingClient` (REC-04, ADR-0011, ADR-0019 заменены)
  не копировал. Отказ перевозчика (не-2xx, `HttpRequestException`, отклонение конвейером, битый JSON) клиент превращает в `null`,
  хендлер - в `CarrierUnavailableError`: недоступность перевозчика - ожидаемый исход для клиента API (502).
- **Вызов перевозчика вне транзакции.** Сначала чтение, потом внешний вызов, потом запись, чтобы не держать соединение
  с БД на время HTTP.
- **Гонка с передачей перевозчику.** `Status` помечен токеном конкурентности: если за время вызова перевозчика отправление
  передали, сохранение котировки упадёт `DbUpdateConcurrencyException`, а не запишет котировку на переданное отправление.
  Два одновременных запроса котировки в `Created` не конфликтуют: побеждает последний.
- **`TimeProvider`, не `DateTime.UtcNow`** (ADR-0012) - в новом коде; существующий `DateTime.UtcNow` в `Shipment.Create` не менял.
- **Идентификатор отправления - `Guid`**, как в существующих командах и `Shipment` (типизированного `ShipmentId` нет; введение
  затронуло бы весь сервис, ADR-0006 - для нового кода, перевод вынесен отдельно).

## Допущения и открытые вопросы

- Формат `from`/`to` в `docs/specs/carrier-api.md` не описан. Сейчас передаётся `{Country}-{PostalCode}`
  (`QuoteShipmentHandler.Place`); уточнить у перевозчика, при необходимости правится в одном месте.
- Спецификация не описывает аутентификацию к перевозчику; ключ не передаётся (как и в `CarrierTrackingClient`).
- Пакет `Microsoft.Extensions.Http.Resilience` в csproj не добавлял: в репозитории нет ссылок на пакеты (Orders вызывает
  `AddStandardResilienceHandler` так же); проверить при сборке. Пределы повторов/таймаутов - значения по умолчанию, секцию
  `Resilience:CarrierRates` (ADR-0026) не подключал.
- `Program.cs` Shipping вызывает только `AddShippingEntities` и не вызывает `AddShipping`/`MapShipments`; реализации
  `IOutbox`/`IUnitOfWork` в репозитории нет. Сквозное подключение вне этой задачи; без него эндпоинт не поднимется.
- Потребитель события на стороне Orders не написан: в Orders нет ни консьюмеров, ни поля стоимости доставки в `Order`;
  контракт события готов к подписке.
- Тесты не добавлял (RUL-0016: задача их не требует); сборка и запуск недоступны, код не компилировался.
