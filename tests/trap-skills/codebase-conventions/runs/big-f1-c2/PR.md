# Shipping: расчёт стоимости доставки `POST /v1/shipments/{id}/quote`

## Изменённые файлы

Новые:
- `libs/Meridian.Contracts/ShipmentQuotedIntegrationEvent.cs`
- `services/shipping/src/Meridian.Shipping/Application/Shipments/QuoteShipmentHandler.cs`
- `services/shipping/src/Meridian.Shipping/Domain/Errors.cs`
- `services/shipping/src/Meridian.Shipping/Domain/ShipmentQuote.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Carriers/CarrierRatesClient.cs`
- `PR.md`

Изменённые:
- `services/shipping/src/Meridian.Shipping/Api/ShipmentEndpoints.cs`
- `services/shipping/src/Meridian.Shipping/Domain/Shipment.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Persistence/ShippingDbContext.cs`
- `services/shipping/src/Meridian.Shipping/Modules/ShippingModule.cs`

## Что делает изменение

`POST /v1/shipments/{id}/quote` запрашивает у перевозчика `GET /rates` (вес и адреса берутся из отправления), сохраняет котировку в отправлении и ставит в outbox событие `ShipmentQuotedIntegrationEvent`, по которому о котировке узнаёт Orders. Котировка доступна, пока отправление в статусе `Created`; повторный запрос заменяет прежнюю. Срок действия - 24 часа (`ExpiresAt`).

Ответ 200: `{ priceMinor, currency, etaDays, expiresAt }`. Ошибки - ProblemDetails с `code`:
- `shipment.not_found` - 404;
- `shipment.quote_not_allowed` - 409 (отправление уже не в `Created`);
- `shipment.carrier_unavailable` - 502 (перевозчик не ответил или вернул некорректные данные).

## Технические решения

1. **Деньги.** Перевозчик отдаёт `decimal` в единицах валюты; на границе клиента (`CarrierRatesClient`) цена переводится в `long` минорных единиц и дальше живёт как `Money` (RUL-0009). `decimal` есть только в приватном DTO ответа. Минорная единица определяется по ISO 4217 (0/2/3 знака; небольшой список исключений, по умолчанию 2), округление - от нуля. Цена вне диапазона `long` или отрицательная считается некорректным ответом.
2. **Хранение котировки.** Owned-тип `ShipmentQuote` (`PriceMinor`, `Currency`, `EtaDays`, `ExpiresAt`) в таблице отправлений, а не отдельная сущность: котировка одна и заменяется, истории не нужно. Валюта котировки - валюта перевозчика, не обязана совпадать с `Shipment.Currency`.
3. **Срок 24 часа.** Время берётся из `TimeProvider` (ADR-0012), в хранилище и контракте - `DateTimeOffset`. Константа `ShipmentQuote.Lifetime`. Просроченная котировка не удаляется и не блокирует передачу перевозчику: об этом в задаче не сказано, потребитель смотрит на `ExpiresAt`.
4. **Ошибки.** Бизнес-отказы - `Result<T>` и наследники `ShippingError` (SHP-ADR-002); исключения не используются. Базовый `ShippingError` ADR упоминает, но в коде его не было - добавлен в `Domain/Errors.cs`. Старые хендлеры (Create/Cancel/Track) не трогал: перевод на Result - отдельный долг. Инвариант в `Shipment.ApplyQuote` дублирует проверку статуса исключением как защиту от ошибки программиста.
5. **Клиент перевозчика.** Отдельный типизированный клиент `CarrierRatesClient`, а не расширение `CarrierTrackingClient` (SHP-ADR-001: адаптер на перевозчика, общий интерфейс не вводим). Повторы и таймауты - `AddStandardResilienceHandler()` с пределами из `Resilience:CarrierRates` (ADR-0026); самописный цикл из `CarrierTrackingClient` (REC-04, заменён ADR-0011 → 0019 → 0026) не копировал. Адрес и ключ - из существующего `CarrierOptions`. Запрос идемпотентный (GET), повторять безопасно.
6. **Событие.** `ShipmentQuotedIntegrationEvent` в `Meridian.Contracts` по RUL-0011, без суффикса `Message`; несёт идентификаторы и факты (RUL-0013), цену в минорных единицах. Публикация - только через `IOutbox` в той же единице работы, что и запись котировки (`IUnitOfWork`, ADR-0021); `IBus.PublishAsync` не использован, хотя соседние хендлеры Shipping так делают (долг). При повторном запросе событие уходит снова; потребитель идемпотентен (RUL-0012) и выбирает актуальную по `OccurredAt`/`ExpiresAt`.
7. **Гонка с передачей перевозчику.** Запрос к перевозчику долгий, за это время отправление могут передать (`HandOver`). Добавлен токен конкурентности на системный столбец PostgreSQL `xmin`: сохранение котировки по устаревшему состоянию упадёт с `DbUpdateConcurrencyException`, и котировка не появится у переданного отправления. `xmin` не требует миграции. Исключение сейчас не переводится в 409 - редкий случай, отдаётся как 500; при желании можно ловить в инфраструктурной обёртке `IUnitOfWork`.
8. **Ответ API.** Приватный `QuoteResponse` в файле эндпоинтов: camelCase, цена `long` + валюта, время UTC (RUL-0001, 0007, 0009). Путь соответствует RUL-0002.

## На что обратить внимание ревьюера

- **Формат `from`/`to`.** Спецификация `docs/specs/carrier-api.md` не говорит, что передавать. Передаётся `PostalCode` адреса отправителя/получателя. Если перевозчику нужен код страны или полный адрес, меняется одна строка в `CarrierRatesClient`. Стоит уточнить у владельца спецификации.
- **Orders.** В репозитории у Orders нет потребителей событий, поэтому реализована публикация; обработчик на стороне Orders не добавлялся (вне сервиса Shipping, нужен договорённый формат хранения).
- **Миграции.** В репозитории нет каталога миграций Shipping, поэтому миграция для новых столбцов котировки не создана; нужна forward-only миграция (ADR-0015) при генерации из модели.
- **Регистрации.** `IOutbox`/`IUnitOfWork` в Shipping (как и в других сервисах) в DI в репозитории не регистрируются; `Program.cs` Shipping не вызывает `AddShipping`/`MapShipments`. Не менял, это существующее состояние.
- **Пакет.** `AddStandardResilienceHandler` требует `Microsoft.Extensions.Http.Resilience`; в csproj Orders и Catalog пакет тоже не указан, поэтому ссылку в csproj Shipping не добавлял. Сборки не было, код не компилировался и не запускался.
- **Тесты** не добавлялись (RUL-0016: задача их не требует).
