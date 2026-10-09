Я добавил тесты на `reservation.ts`. `npm run typecheck` и `npm test` зелёные: 15 тестов, из них 8 новых. Изменён один файл, новый: `api/test/reservation.test.ts`.

- **Склад:** `inventory.reserve` подменён через `vi.spyOn`, а `logger.warn` заглушён. Запросов к настоящему складу нет. Модуль целиком не мокался, а проверки идут по результату (`reservationId`, `attempts`, тип и поля ошибки).
- **Паузы между повторами:** тесты используют fake timers, а `useRealTimers` и `restoreAllMocks` вызываются в `afterEach`.
- **`isHoldExpired`:** для неё есть тесты на границу срока и на `now` по умолчанию. Добавил ещё тест, что срок из `holdUntil` истекает через 15 минут.

Код модуля не менял.