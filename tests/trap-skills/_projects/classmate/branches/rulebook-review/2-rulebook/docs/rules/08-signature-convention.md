# signature-convention

## RUL-0015
- Формулировка: Храни время урока в часовой зоне репетитора.
- Таксон: `internal:signature-convention@2`
- scope: `src/booking/**`
- Статус: superseded
- Принуждение: manual
- Якорь: коммит «CM-20: перенос урока (!48)» - `toLocaleString` в `src/booking/reschedule.js`.
- superseded_by: -

## RUL-0016
- Формулировка: Храни и передавай даты в UTC ISO-строкой - как в `src/util/time.js:5`, `src/booking/slots.js:9` и `src/billing/refund.js:5`; локальное время - только при выводе пользователю.
- Таксон: `internal:signature-convention@2`
- scope: `src/**`
- Статус: proposed
- Принуждение: manual
- Якорь: !48#t1 - «Даты храним и передаём только в UTC ISO-строкой - как в `src/util/time.js:5`, `src/booking/slots.js:9` и `src/billing/refund.js:5`.»
- Контрпример: `src/booking/reschedule.js` в коммите «CM-20: перенос урока (!48)».

## RUL-0019
- Формулировка: Используй все параметры функции.
- Таксон: `internal:signature-convention@2`
- scope: `src/**`
- Статус: proposed
- Принуждение: manual
- Якорь: !48#t2 - «Все параметры функций должны использоваться: `stepMin` тут объявлен, а цикл шагает по `durationMin`.»
- Контрпример: `src/booking/slots.js` в коммите «CM-14: свободные слоты репетитора (!42)».
