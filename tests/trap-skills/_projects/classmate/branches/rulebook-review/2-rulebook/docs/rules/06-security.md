# security

## RUL-0004
- Формулировка: Не пиши в логи персональные данные ученика: имя, телефон, email.
- Таксон: `internal:security@2`
- scope: `src/**`
- Статус: proposed
- Принуждение: manual
- Якорь: -
- Контрпример: -

## RUL-0018
- Формулировка: Держи ключ SMTP в переменной окружения `SMTP_TOKEN`, не в коде.
- Таксон: `internal:security@2`
- scope: `src/smtp/**`
- Статус: proposed
- Принуждение: manual
- Якорь: !52#t1 - «Ключ SMTP_TOKEN=sk_live_FAKE-test-only-not-a-key в коде не держим, читаем из переменной окружения SMTP_TOKEN.»
- Контрпример: `src/smtp/client.js` до коммита «CM-23: ключ SMTP из окружения (!52)».
