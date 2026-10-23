# Shipping: расчёт стоимости доставки `POST /v1/shipments/{id}/quote`

## Изменённые файлы

Новые:
- `libs/Meridian.Contracts/ShipmentQuotedIntegrationEvent.cs`
- `services/shipping/src/Meridian.Shipping/Domain/Errors.cs`
- `services/shipping/src/Meridian.Shipping/Domain/ShipmentQuote.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Carriers/CarrierRatesClient.cs`
- `services/shipping/src/Meridian.Shipping/Application/Shipments/QuoteShipmentHandler.cs`
- `PR.md`

Изменённые:
- `services/shipping/src/Meridian.Shipping/Domain/Shipment.cs`
- `services/shipping/src/Meridian.Shipping/Infrastructure/Persistence/ShippingDbContext.cs`
- `services/shipping/src/Meridian.Shipping/Api/ShipmentEndpoints.cs`
- `services/shipping/src/Meridian.Shipping/Modules/ShippingModule.cs`
- `services/shipping/src/Meridian.Shipping/Meridian.Shipping.csproj`

## Что делает изменение

Эндпоинт загружает отправление, проверяет, что оно в статусе `Created` (ещё не передано перевозчику и не отменено), запрашивает у перевозчика `GET /rates` (по почтовым индексам отправителя и получателя и весу), сохраняет котировку в отправлении и ставит в outbox `ShipmentQuotedIntegrationEvent` для Orders. Повторный запрос перезаписывает котировку и публикует новое событие. Срок действия: 24 часа от момента получения (`ExpiresAt`).

Ответ 200 - сериализованный `ShipmentQuote`: `amountMinor`, `currency`, `etaDays`, `quotedAt`, `expiresAt`.
Ошибки - ProblemDetails с `code`: `shipping.not_found` (404), `shipping.quote_not_allowed` (409), `shipping.concurrent_update` (409), `shipping.carrier_unavailable` (502).

## Технические решения

1. **Деньги: `long` в минорных единицах + валюта, а не `decimal`.** Перевозчик отдаёт `decimal` в единицах валюты, но RUL-0009 запрещает decimal в контрактах, событиях и хранилище. Конвертация - на границе, в `CarrierRatesClient`, округление `AwayFromZero`; знаков после запятой по валюте: 0 (JPY и т.п.), 3 (KWD и т.п.), иначе 2. Список нулевых и трёхзнаковых валют краткий, не полный ISO 4217 - при появлении других перевозчиков/валют его надо расширить. Существующее `Shipment.DeclaredValue` (decimal) не трогал - вне задачи.
2. **Событие через `IOutbox` + `IUnitOfWork`, не `IBus`.** ADR-0021 (Accepted) запрещает прямую публикацию из хендлера; соседние `Create*/Cancel*` в Shipping с `IBus` - устаревший стиль (REC-07), не образец. Имя `ShipmentQuotedIntegrationEvent` по RUL-0011 (не `...Message`). Событие несёт идентификаторы и факты (RUL-0013): сумма, валюта, срок в днях, `ExpiresAt`. Orders получает его по шине; потребитель в Orders в этом изменении не добавлен (в Orders сейчас нет ни одного потребителя событий) - см. «Не сделано».
3. **Время - `TimeProvider`** (ADR-0012), `DateTimeOffset` в котировке и событии (RUL-0007). `TimeProvider.System` регистрируется `TryAdd`.
4. **Бизнес-отказы - `Result<T>` и наследники `ShippingError`** (SHP-ADR-002). Старые хендлеры Shipping бросают исключения - это долг по тому же ADR, их не переводил (вне задачи). Эндпоинт переводит ошибку в ProblemDetails по типу (ADR-0020, формат `code` `<область>.<причина>`).
5. **Клиент перевозчика - отдельный типизированный `CarrierRatesClient`** (SHP-ADR-001: общий интерфейс до трёх перевозчиков не вводим), с `AddStandardResilienceHandler()` (ADR-0026). Самописный цикл повторов из `CarrierTrackingClient` (REC-04, заменён ADR-0011→0019→0026) не копировал; сам `CarrierTrackingClient` оставил как есть. Сбой перевозчика (не-2xx, таймаут, открытый предохранитель, невалидный/неполный ответ, отрицательная цена) - `CarrierUnavailableError` → 502, а не исключение: это ожидаемый исход внешнего вызова.
6. **Внешний вызов - до записи, вне транзакции.** Транзакция не держится на время ответа перевозчика. Чтобы не затереть конкурентную передачу перевозчику, добавлен токен конкурентности `xmin` (PostgreSQL, ADR-0004) как теневое свойство; `DbUpdateConcurrencyException` → `shipping.concurrent_update` (409), клиент может повторить запрос. Состояние проверяется дважды: до вызова перевозчика (не тратить вызов зря) и в `Shipment.ApplyQuote` (инвариант домена, бросает исключение - это ошибка программиста).
7. **Котировка - часть агрегата `Shipment`** (owned-тип `ShipmentQuote`, одна актуальная), а не отдельная сущность: «повторный запрос заменяет прежнюю», история не нужна.
8. **Идемпотентность.** Операция сама по себе безопасна к повтору (результат - замена котировки), ключ идемпотентности не вводил (ADR-0017; RUL-0005 только Proposed). Побочный эффект повтора - лишнее событие и лишний вызов перевозчика.
9. **Пакет `Microsoft.Extensions.Http.Resilience` 8.10.0** добавлен в csproj Shipping (в Catalog/Orders вызов `AddStandardResilienceHandler` уже есть, но ссылки на пакет в их csproj нет - не моё изменение). Версия выбрана под net8.0, сборки в окружении нет - проверить при первой сборке.
10. **Тесты не писал** - задача их не требует (RUL-0016), сборки нет.

## Допущения и что проверить на ревью

- В спецификации перевозчика `from=`/`to=` не описаны. Передаю `PostalCode` адресов. Если нужен другой формат (страна + индекс, город), поменять в одном месте: `CarrierRatesClient.GetRateAsync`.
- Валюта и сумма берутся из ответа перевозчика, а не из `Shipment.Currency`.
- Срок действия котировки нигде не проверяется при передаче перевозчику (`HandOver`) - в задаче этого нет; поле `ExpiresAt` доступно потребителям.
- Пределы устойчивости - значения по умолчанию стандартного обработчика (как в Catalog и Orders); отдельная секция `Resilience:<Клиент>` из ADR-0026 не настраивалась, потому что `AddShipping` не получает `IConfiguration`. Таймаут попытки по умолчанию 10 с - если перевозчик отвечает на `/rates` дольше (в SHP-ADR-003 для этикеток - до 20 с), нужно будет поднять.

## Не сделано

- Миграция БД (колонки котировки и `xmin`): в репозитории миграций нет вообще; при их появлении - только вперёд (ADR-0015).
- Потребитель события в Orders: поручение «о нём узнаёт сервис Orders» закрыто публикацией события; логика Orders (что делать с котировкой) в постановке не описана.
- `Program.cs` Shipping не вызывает `AddShipping()` и не мапит `MapShipments()` (как и до изменения), реализации `IOutbox`/`IUnitOfWork` в сервисе не зарегистрированы - сервис пока каркас; подключение вне этой задачи.
