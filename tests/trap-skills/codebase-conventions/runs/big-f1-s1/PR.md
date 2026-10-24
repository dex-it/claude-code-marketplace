# Shipping: расчёт стоимости доставки `POST /v1/shipments/{id}/quote`

Сборки и тестов нет (доступен только git): код не компилировался и не запускался.

## Что делает

Эндпоинт запрашивает у API перевозчика (`GET /rates`, `docs/specs/carrier-api.md`) цену и срок, сохраняет котировку в отправлении (действует 24 часа), публикует `ShipmentQuotedIntegrationEvent` для Orders и возвращает котировку. Котировка доступна, пока отправление в статусе `Created`; повторный запрос заменяет прежнюю.

Ответ 200: `{ priceMinor, currency, etaDays, quotedAt, expiresAt }`. Ошибки - ProblemDetails с `code`: `shipment.not_found` (404), `shipment.not_quotable` (409).

## Изменённые файлы

Новые:
- `libs/Meridian.Contracts/ShipmentQuotedIntegrationEvent.cs`
- `services/shipping/src/Meridian.Shipping/Api/ShippingProblems.cs`
- `.../Application/Shipments/QuoteShipmentHandler.cs`
- `.../Domain/Errors.cs`, `.../Domain/ShipmentId.cs`, `.../Domain/ShipmentQuote.cs`
- `.../Infrastructure/Carriers/CarrierRatesClient.cs`

Изменённые:
- `.../Api/ShipmentEndpoints.cs`, `.../Domain/Shipment.cs`, `.../Infrastructure/Persistence/ShippingDbContext.cs`, `.../Modules/ShippingModule.cs`, `.../Meridian.Shipping.csproj`

## Решения

- **Бизнес-отказы - `Result<T>`, не исключения.** SHP-ADR-002 (Accepted): новый код отказ исключением не выражает. Ошибки - наследники `ShippingError` (базовый тип из ADR заведён здесь, его ещё не было). Сосед `TrackShipmentHandler`/`CancelShipmentHandler` бросает исключения - это долг по ADR, его не повторяю и не трогаю. Эндпоинт мапит ошибку в статус по типу (`ShippingProblems`). Сбой перевозчика (5xx после повторов, невалидный ответ) - исключение, как инфраструктурный сбой.
- **Вызов перевозчика - `CarrierRatesClient` с `AddStandardResilienceHandler()`**, пределы из `Resilience:CarrierRates`. ADR-0026 (Accepted) заменил Polly (ADR-0011/ADR-0019) и цикл повторов (REC-04); `CarrierTrackingClient` с циклом - легаси, не копирую. Отдельный клиент, без общего интерфейса - SHP-ADR-001 (перевозчиков меньше трёх). Добавлен пакет `Microsoft.Extensions.Http.Resilience` 8.10.0 (в csproj Shipping его не было).
- **Вызов синхронный в запросе.** Пользователь ждёт цену в ответе; SHP-ADR-003 (асинхронность) относится к печати этикеток, у котировки (`GET /rates`) такого ограничения в спеке нет.
- **Деньги.** Перевозчик отдаёт `decimal` в единицах валюты; в клиенте (на границе) переводится в `Money` (минорные единицы, `long` + валюта) - RUL-0009. Округление `AwayFromZero`, разрядность валюты: 0 (JPY, KRW, VND, CLP, ISK), 3 (BHD, JOD, KWD, OMR, TND), иначе 2. В хранилище и событии - `long` + `Currency`. Валюта котировки - из ответа перевозчика, она может отличаться от `Shipment.Currency` (валюта объявленной стоимости).
- **Событие через outbox.** `IOutbox.EnqueueAsync` + `IUnitOfWork.CommitAsync` в одной единице работы - ADR-0021 (ADR-0009 и REC-07 отменены, `IBus.PublishAsync` как в `CreateShipmentHandler` не используется). Имя `ShipmentQuotedIntegrationEvent` - RUL-0011 (суффикс `Message` у соседних событий Shipping - старый стиль). Содержимое - идентификаторы и факты (RUL-0013), `ExpiresAt` в событии, чтобы Orders не считал срок сам. Событие уходит при каждом (в том числе повторном) запросе; потребителю достаточно брать котировку с максимальным `OccurredAt` (RUL-0012).
- **Время - `TimeProvider`** (ADR-0012), `DateTimeOffset` (RUL-0007). 24 часа - константа `ShipmentQuote.Lifetime`: это правило домена из постановки, не настройка окружения.
- **Типизированный id.** Новый код использует `ShipmentId` (ADR-0006) в команде и ошибках. `Shipment.Id` и `IShipmentRepository` остаются на `Guid` - перевод существующей сущности и репозитория вне объёма задачи.
- **Котировка как owned-тип `ShipmentQuote`** (поля `PriceMinor`, `Currency`, `EtaDays`, `QuotedAt`, `ExpiresAt`) в таблице отправлений; `Money` вычисляется. Не `Money` как поле: EF Core 8 не поддерживает struct как owned-тип. Замена котировки перезаписывает те же колонки, истории нет (в постановке не требуется).
- **Проверка статуса до вызова перевозчика** (`CanBeQuoted` = `Created`), чтобы не ходить во внешний API зря. Отменённое (`Cancelled`) отправление тоже не котируется - в постановке явно не сказано, выбрано как бессмысленная операция. Метод `ApplyQuote` в домене повторно защищён исключением (ошибка программиста), как `HandOver`.
- **Тесты не добавлены** - постановка их не требует (RUL-0016).

## Допущения и остаточные риски

- **Формат `from`/`to` в `/rates` в спеке не описан.** Передаётся `PostalCode` отправителя и получателя. Нужно подтвердить с владельцем интеграции (при международных отправлениях может понадобиться страна).
- **Миграции.** В репозитории миграций Shipping нет; колонки `Quote_*` появятся при следующей генерации (forward-only, ADR-0015 / RUL-0008).
- **Гонка с передачей перевозчику.** Пока идёт запрос к перевозчику, отправление может быть передано другим запросом; в `Shipment` нет токена конкурентности, и котировка запишется поверх. Токен потребует правки модели сущности - отдельная задача.
- **Инфраструктура.** В репозитории нет реализаций `IOutbox`/`IUnitOfWork` и регистрации `TimeProvider` ни в одном сервисе, а `Program.cs` Shipping не вызывает `AddShipping()` и не мапит эндпоинты - как и у остальных сервисов. Я это не менял. Для работы эндпоинта должны быть подключены `AddShipping()`, `MapShipments()`, `TimeProvider.System`, `IOutbox`, `IUnitOfWork` (на тот же `ShippingDbContext`).
- **Потребитель в Orders не написан** - в постановке «Orders узнаёт» закрыто публикацией события; обработчика в Orders пока нет (подписочной инфраструктуры в репозитории нет).
