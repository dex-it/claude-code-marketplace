# Изменения контракта Bookings API

- 1.3.0 (2026-10-06) - совместимые изменения: продление брони, статус pending, поле participantsCount; поиск броней по названию, поле externalRef, оснащение phonebooth, ответ 422 у переноса.
- 1.2.0 (2026-09-15) - лента броней `GET /api/v1/bookings` с курсором; `GET /api/v1/rooms/{roomId}/bookings` устарела (замена - `GET /api/v1/bookings?roomId=`, удаление после 2027-03-01).
- 1.1.0 (2026-07-01) - перенос брони `PATCH /api/v1/bookings/{bookingId}` с версией (409 `version-conflict`).
- 1.0.0 (2026-05-12) - комнаты, брони комнаты, создание, получение и отмена брони; ошибки - problem+json с `code`.
