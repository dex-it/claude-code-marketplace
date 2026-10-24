# Shipping: расчёт стоимости доставки (`POST /v1/shipments/{id}/quote`)

Стоимость и срок запрашиваются у API перевозчика (`GET /rates`, `docs/specs/carrier-api.md`), котировка сохраняется в отправлении, сервис Orders узнаёт о ней из интеграционного события. Котировка доступна, пока отправление в статусе `Created` (не передано перевозчику); повторный запрос заменяет прежнюю; действует 24 часа.

Сборки и тестов не было (из инструментов только git), код не компилировался.

## Изменённые файлы

Новые:
- `libs/Meridian.Contracts/ShipmentQuotedIntegrationEvent.cs`
- `services/shipping/src/Meridian.Shipping/Domain/ShipmentId.cs`
- `services/shipping/src/Meridian.Shipping/Domain/ShipmentQuote.cs`
- `services/shipping/src/Meridian.Shipping/Domain/Errors.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Carriers/CarrierRatesClient.cs`
- `services/shipping/src/Meridian.Shipping/Application/Shipments/QuoteShipmentHandler.cs`

Изменённые:
- `services/shipping/src/Meridian.Shipping/Domain/Shipment.cs` - `Quote`, `QuoteValidity`, `ApplyQuote`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Persistence/ShippingDbContext.cs` - owned-тип `Quote`
- `services/shipping/src/Meridian.Shipping/Api/ShipmentEndpoints.cs` - эндпоинт и перевод ошибки в ProblemDetails
- `services/shipping/src/Meridian.Shipping/Modules/ShippingModule.cs` - клиент, хендлер, `TimeProvider`
- `services/shipping/src/Meridian.Shipping/Meridian.Shipping.csproj` - пакет `Microsoft.Extensions.Http.Resilience`

## Поведение

- Нет отправления: 404, `code = shipment.not_found`.
- Статус не `Created`: 409, `code = shipment.not_quotable`.
- Успех: 200, `{ priceMinor, currency, etaDays, expiresAt }`.
- Сбой перевозчика (не 2xx, пустой или некорректный ответ): исключение, 500.

## Технические решения

1. **Новый хендлер возвращает `Result<T>`, ошибки - наследники `ShippingError`.** Источник: SHP-ADR-002 (Accepted): новый код отказ исключением не выражает. Соседи `Create/Cancel/TrackShipmentHandler` бросают исключения - это названный в ADR долг, их не копировал и не переводил (вне задачи). Тип ошибки переводится в статус в эндпоинте (404 / 409); `code` формата `<область>.<причина>` (ADR-0020, RUL-0003). Сбой перевозчика - сбой инфраструктуры, по тому же ADR остаётся исключением.
2. **Событие `ShipmentQuotedIntegrationEvent` через `IOutbox.EnqueueAsync` и `IUnitOfWork.CommitAsync`, без `IBus`.** ADR-0021 (Accepted, заменил ADR-0009 и REC-07): запись и событие в одной единице работы. Существующие `bus.PublishAsync` в соседях - легаси, не копировал. Отдельного `SaveChangesAsync` нет: иначе изменение и событие не атомарны. Имя по RUL-0011 (суффикс `IntegrationEvent`, тип в `Meridian.Contracts`). Событие несёт идентификаторы и факты (RUL-0013): `ShipmentId`, `OrderId`, цена, срок, `ExpiresAt`.
3. **Деньги: `long` в минорных единицах + валюта.** RUL-0009 для события и хранилища; в коде - `Money`. Десятичная цена внешнего API переводится в минорные единицы на границе, в `CarrierRatesClient`, округление `AwayFromZero`. Число знаков валюты: 0 / 3 для небольшого набора ISO 4217, иначе 2 - упрощение, при расширении списка валют вынести в общий справочник.
4. **Время: `TimeProvider`, `DateTimeOffset`.** ADR-0012 и RUL-0007. `DateTime.UtcNow` из соседей не копировал. `TimeProvider.System` регистрируется через `TryAddSingleton`.
5. **Исходящий HTTP: `AddHttpClient<CarrierRatesClient>().AddStandardResilienceHandler()`, цикла повторов нет.** ADR-0026 (Accepted); соседний `CarrierTrackingClient` (цикл, REC-04) и Payments (Polly, ADR-0011) - заменённые решения, им не следовал. В csproj добавлен пакет `Microsoft.Extensions.Http.Resilience` 8.10.0 (на .NET 8, ADR-0003); версию стоит сверить с принятой в команде. Пределы из `Resilience:<Клиент>` не настраивал - значения по умолчанию.
6. **Отдельный типизированный клиент, без общего интерфейса.** SHP-ADR-001: интерфейс не вводим, пока перевозчиков меньше трёх. Клиент тракинга не расширял: другой ресурс и другой набор ответов. Базовый адрес и `CarrierOptions` общие (RUL-0021 уже соблюдён).
7. **`ShipmentId` - `readonly record struct` в домене, `Guid.CreateVersion7()` не нужен.** ADR-0006: в новом коде нет сырого `Guid` в сигнатурах доменного слоя. Идентификатор создаётся уже существующей записью, новых id нет. `Shipment.Id` остаётся `Guid` (легаси, перевод - отдельная задача); на границе хендлер берёт `.Value`. В событии `Guid`, как в `OrderPlacedIntegrationEvent`.
8. **Котировка - owned-запись `ShipmentQuote` внутри `Shipment`, а не отдельная таблица.** Одна актуальная котировка на отправление, повторный запрос заменяет прежнюю, история не требуется. Колонки добавляются в таблицу отправлений (nullable). Миграции только вперёд (RUL-0008); миграций в репозитории нет, не создавал.
9. **24 часа - константа `Shipment.QuoteValidity`, а не настройка.** Это бизнес-правило из поручения, а не параметр окружения. Срок считается от `now` на момент ответа перевозчика. Проверку срока при передаче перевозчику не добавлял: `HandOver` вне поручения.
10. **Отправление не в `Created` (в т.ч. `Cancelled`) - отказ.** Поручение: «пока не передано перевозчику»; для отменённого котировка бессмысленна. Проверка есть и в хендлере (бизнес-отказ значением), и в `ApplyQuote` (исключение для ошибки программиста, как `HandOver`).
11. **Формат `from`/`to` для перевозчика - почтовый индекс.** Спека (`carrier-api.md`) формат не определяет; это допущение, изолированное в одном месте (`CarrierRatesClient.GetRateAsync`). Нужно подтвердить у владельцев интеграции.
12. **Тесты не добавлял.** RUL-0016: задача их не требует.

## Что не сделано / на заметку

- `Program.cs` сервиса не вызывает `AddShipping()` и `MapShipments()`, нет и регистрации `ShippingDbContext`, `IUnitOfWork`, `IOutbox` - так во всех сервисах репозитория; не трогал. До их подключения эндпоинт не доступен.
- Потребителя события в Orders нет: в Orders нет инфраструктуры потребителей. Контракт события готов; потребитель должен быть идемпотентным (RUL-0012, `EventId`).
- Гонка с передачей перевозчику между чтением статуса и коммитом (токена конкурентности у `Shipment` нет) - не закрывал.
