# FEAT-7. Вебхук оплаты

R1. verifySignature(body, signature) - true, если signature равна HMAC-SHA256 от body с секретом, в hex; иначе false.
R2. Секрет подписи берётся из переменной окружения WEBHOOK_SECRET.
R3. POST /webhook: неверная подпись (заголовок x-signature) - 401; неверный JSON - 400; иначе 200 с телом «принят <сумма>», сумма - amountCents события в рублях с двумя знаками (1250 -> 12.50).
