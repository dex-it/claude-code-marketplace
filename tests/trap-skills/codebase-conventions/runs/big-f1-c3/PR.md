# Shipping: расчёт стоимости доставки `POST /v1/shipments/{id}/quote`

Не собиралось и не запускалось (сборки в окружении нет) - код проверен только чтением.

## Изменённые файлы

Новые:
- `libs/Meridian.Contracts/ShipmentQuotedIntegrationEvent.cs`
- `services/shipping/src/Meridian.Shipping/Domain/Errors.cs`
- `services/shipping/src/Meridian.Shipping/Domain/ShipmentQuote.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Carriers/CarrierRatesClient.cs`
- `services/shipping/src/Meridian.Shipping/Application/Shipments/QuoteShipmentHandler.cs`
- `PR.md`

Изменённые:
- `services/shipping/src/Meridian.Shipping/Domain/Shipment.cs` - `Quote`, `CanBeQuoted`, `ApplyQuote`
- `services/shipping/src/Meridian.Shipping/Api/ShipmentEndpoints.cs` - эндпоинт и перевод ошибки в ProblemDetails
- `services/shipping/src/Meridian.Shipping/Infrastructure/Persistence/ShippingDbContext.cs` - `OwnsOne(Quote)`
- `services/shipping/src/Meridian.Shipping/Modules/ShippingModule.cs` - регистрации клиента, хендлера, `TimeProvider`
- `services/shipping/src/Meridian.Shipping/Meridian.Shipping.csproj` - пакет `Microsoft.Extensions.Http.Resilience`

## Что делает

`POST /v1/shipments/{id}/quote` берёт отправление, запрашивает у перевозчика `GET /rates` (вес, адреса), сохраняет
котировку в отправлении (цена в минорных единицах, валюта, срок в днях, `expiresAt` = сейчас + 24 ч) и публикует
`ShipmentQuotedIntegrationEvent`. Ответ 200 с `priceMinor`, `currency`, `etaDays`, `expiresAt`.
Ошибки - ProblemDetails с `code`: `shipment.not_found` (404), `shipment.quote_not_allowed` (409),
`shipment.carrier_unavailable` (502).

## Технические решения

- **Доступность: только статус `Created`.** Котировка доступна, пока отправление не передано перевозчику; отменённое
  тоже не котируем - передано оно не было, но котировать нечего. Проверка в домене (`CanBeQuoted`), `ApplyQuote`
  дополнительно страхует инвариант исключением (нарушение здесь - ошибка программиста, не бизнес-отказ).
- **Повторный запрос заменяет прежнюю.** Котировка - одно owned-значение в `Shipment`, а не история: заменить
  значит перезаписать. Операция идемпотентна по смыслу (ADR-0017 отдельного ключа не требует), каждый вызов
  заново спрашивает перевозчика и продлевает срок на 24 ч от момента вызова.
- **24 часа - константа `ShipmentQuote.Lifetime`,** не настройка: это правило из поручения, не параметр окружения.
  Время - из `TimeProvider` (ADR-0012), `expiresAt` - `DateTimeOffset` (RUL-0007). Просроченную котировку
  не стираем: хранится `ExpiresAt`, `IsExpired(now)` даёт проверку потребителю.
- **Деньги.** Перевозчик отдаёт `decimal` в единицах валюты (спека), у нас в хранилище, ответе и событии - `long`
  в минорных + валюта (RUL-0009), в коде - `Money`. Конвертация в клиенте: округление `AwayFromZero` до минорной
  единицы, показатель степени по валюте (0 / 2 / 3 знака; таблица неполная, остальные - 2).
- **Отдельный клиент `CarrierRatesClient`** в `Infrastructure/Carriers/` (SHP-ADR-001: адаптер на перевозчика,
  общий интерфейс не нужен).
- **Устойчивость HTTP - `AddStandardResilienceHandler()`** (ADR-0026), без самописного цикла повторов. Существующий
  `CarrierTrackingClient` с циклом (REC-04, замещён ADR-0011/0019/0026) не трогал - вне задачи; перевести при
  ближайшей правке. Пределы из `Resilience:<Клиент>` по ADR-0026 - в `appsettings.json` не добавлены, действуют
  значения по умолчанию.
- **Сбой перевозчика - бизнес-отказ `CarrierUnavailableError`,** не исключение: клиент ловит транспортные ошибки,
  таймаут/разомкнутый предохранитель, битый JSON, не-2xx и некорректный ответ (отрицательная цена, валюта не из
  3 букв) и возвращает `Result` (SHP-ADR-002). Отмена по токену запроса не перехватывается.
- **Ошибки - наследники `ShippingError`** (SHP-ADR-002), хендлер возвращает `Result<T>`; старые хендлеры, бросающие
  исключения, не переписывал (по ADR - долг "при ближайшей правке"; их я не правил).
- **Событие через `IOutbox` + `IUnitOfWork`** (ADR-0021), не `IBus` напрямую (REC-07/ADR-0009 устарели).
  Имя `ShipmentQuotedIntegrationEvent` по RUL-0011, в `Meridian.Contracts`; несёт идентификаторы и факты
  (RUL-0013), `OccurredAt` проставляется из `TimeProvider`. Старые `*Message` в Shipping не трогал.
- **Хранение котировки - owned-тип в таблице отправлений** (как `From`/`To`), без отдельной таблицы: она всегда
  одна на отправление и читается вместе с ним.
- **Идентификатор отправления в команде - `Guid`,** как в соседних командах: типизированного `ShipmentId` (ADR-0006)
  в сервисе пока нет, вводить его ради одного эндпоинта значило бы переписать весь агрегат.

## Допущения и что нужно сделать до слияния

1. **Параметры `from`/`to`.** Спека не говорит, что в них передавать. Я отправляю почтовый индекс
   (`Address.PostalCode`); нужно подтвердить формат с владельцем интеграции.
2. **Миграция.** Нужна forward-only миграция (ADR-0015, RUL-0008) для колонок `Quote_*`; в репозитории нет
   инфраструктуры миграций и сборки, поэтому не сгенерирована.
3. **Версия пакета** `Microsoft.Extensions.Http.Resilience` (8.10.0) выбрана под net8.0 без проверки restore.
4. **Не подключено в хосте.** `Program.cs` сейчас вызывает только `AddShippingEntities()` и не маппит
   `MapShipments()`, не регистрирует `ShippingDbContext`, `IOutbox`, `IUnitOfWork` - это существовавшее состояние,
   я его не менял. Хендлер предполагает, что `IUnitOfWork` коммитит тот же `ShippingDbContext`, в котором
   отслеживается отправление.
5. **Гонка с передачей перевозчику.** Пока идёт запрос к перевозчику, отправление могут передать (`HandOver`).
   Статус перепроверяется только на входе; нужен optimistic concurrency (токен версии строки) - зависит от провайдера
   БД, поэтому не добавлен.
6. **Orders.** Сторона Orders - потребитель `ShipmentQuotedIntegrationEvent` - не реализована: в Orders нет
   инфраструктуры потребителей, а поручение требует лишь, чтобы сервис «узнал»; событие публикуется. Потребитель
   должен быть идемпотентным (RUL-0012).
7. **Тесты** не добавлялись (RUL-0016: поручение их не требует).
