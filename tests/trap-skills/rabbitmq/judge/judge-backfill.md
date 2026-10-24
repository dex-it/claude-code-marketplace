# Судья добора (правило 11): rabbitmq, RV-B (B7, O1) и G-B (B2), прогоны r3, r4, c3, c4
Судья - оператор смены (не отдельный субагент). Прогоны r1, r2, c1, c2 - из `judge-r.md` и протокола контроля. `?` - клетка спорная, считается по букве ключа.

## RV-B
| ед. | r1 | r2 | r3 | r4 | c1 | c2 | c3 | c4 | основание добора |
|---|---|---|---|---|---|---|---|---|---|
| B7 | 1? | 0 | 1? | 0 | 1? | 1? | 0 | 0 | r3: OrderShippedConsumer.cs:23 бросает при отсутствии платежа, с бесконечным retry крутится - порядок событий не назван (как r1). r4: OrderShippedConsumer не назван. c3: «Payment not found» только примером в находке про Immediate(int.MaxValue) (PaymentsServiceCollectionExtensions.cs:24), место не ключа. c4: то же в :24, но с именем OrderShippedConsumer и бесконечным циклом - место не ключа, по букве 0, `?` |
| O1 | 1 | 0 | 1 | 0 | 1 | 1 | 0 | 1 | r3: CapturePaymentConsumer.cs:25 «Discount не применяется, списывается полный Total» (major); c4: тот же :25. r4 и c3: только SubmitOrderEndpoint.cs:37/42 «Total не учитывает Discount» - другое место (как r2), 0 |

## G-B (код)
| ед. | r1 | r2 | r3 | r4 | c1 | c2 | c3 | c4 | основание добора |
|---|---|---|---|---|---|---|---|---|---|
| B2 | 1 | 0? | 0 | 1 | 1 | 1 | 1 | 1 | приход: во всех добор-прогонах отметка messageId (r3 транзакция processed, r4 StockLedger, c3 inboundIds, c4 inboundIds). Платёж: r4 проверка `payments` по OrderId до ChargeAsync; c3 `Find(OrderId)` до ChargeAsync; c4 `previous` по `_id` до ChargeAsync - 1. r3: `ChargeAsync` безусловно (DIFF:159), в ANSWER заявлены «outbox и inbox» потребителей, но `UseMongoDbOutbox` на конечных точках не настроен (в DIFF только `AddMongoDbOutbox` для шины) - защиты повтора нет, 0 |

Итог: B7 r 2/4, c 2/4; O1 r 2/4, c 3/4; B2 r 2/4, c 4/4.
