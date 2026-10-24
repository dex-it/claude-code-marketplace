# Судья ревизии s: rabbitmq (G-B, RV-B), прогоны s1, s2
Ревизия снята по ревью mmx003 (PR #381): правило 11 не объявляет сужение для B2, пункт убран из поставки; таблица - запись отменённой ревизии, результат B2 2/2 в «Открыто» не закрывает.
Судья - оператор смены. Ревизия s = r плюс название «Обработчик, который повторная доставка применит дважды: приращение остатка, списание платежа» (правило 11, коммит `42b92978` до прогонов).

## G-B (rabbitmq/runs/g-b-s1, g-b-s2)
| ед. | s1 | s2 | основание |
|---|---|---|---|
| B2 | 1 | 1 | s1: платёж - вставка записи `Charging` с `_id`=orderId до `ChargeAsync`, повтор читает итог (CapturePaymentConsumer, DIFF:63-91); приход - `applied` по messageId одним `FindOneAndUpdate` (:661-668). s2: платёж - `Find` записи по orderId до `ChargeAsync` (:79-84), приход - `inbox` по messageId в транзакции (:661-683); окно между списанием и записью сам называет в комментарии |
| B3 | 1 | 1 | BasicQosAsync (s1 :611, s2 :606) |
| B1 | 1 | 1 | autoAck: false (s1 :626, s2 :610) |

Остальные единицы G-B (B4-B10) в s не перепроверялись построчно: пункты B3, B4, B9 не менялись, B2 судится как единица названия.

## RV-B (rabbitmq/runs/rv-b-s1, rv-b-s2)
| ед. | s1 | s2 | основание |
|---|---|---|---|
| B1-B6, B8-B10 | 1 | 1 | все найдены в месте ключа: autoAck/prefetch :52, дедуп :69, outbox SubmitOrderEndpoint.cs:42, durable :38, Immediate(int.MaxValue) :24, корреляция :34/:38, ReleaseStock :64, InMemoryRepository :18 |
| B2 | 1 | 1 | CapturePaymentConsumer.cs:26 и WarehouseInboundConsumer.cs:69 |
| B7 | 0 | 1? | s1 OrderShippedConsumer не назван; s2 :22 бросает при отсутствии платежа, порядок не назван |
| O1 | 0 | 1 | s1 только SubmitOrderEndpoint.cs:37 (другое место, как r2); s2 CapturePaymentConsumer.cs:25 |
| O2 | 1 | 1 | CapturePaymentConsumer.cs:34 |
| P1, P2 | 1 | 1 | StockLevelsConsumer не заявлен |

B7 и O1 в s - 1/2 и 1/2, как в r и добор-вердикте «шум» (суммарно с r/c: см. протокол).
