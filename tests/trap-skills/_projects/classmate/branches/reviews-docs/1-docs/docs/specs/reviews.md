---
type: tech-spec
status: review
owner: Пётр
updated: 2026-10-13
---

# Отзывы о репетиторах - tech spec

Продуктовые требования - `docs/prd/reviews.md`; формула рейтинга - `docs/product/rating.md`.

## Модель данных

Отзыв - событие `review_posted` в таблице `booking_events` (ADR-0003): `booking_id`, `student_id`, `tutor_id`,
`text`, `moderation_status`, `created_at`. Ответ репетитора - событие `review_replied` с `reply_to`.

Существующие оценки 1-5 (поле `rating` в `bookings`, ~14 000 строк) переносятся в `booking_events` событиями
`review_posted` без текста, чтобы рейтинг считался из одного места; поле `rating` удаляется.

## API

- `POST /bookings/:id/review` - текст отзыва; 409, если отзыв уже есть; 403, если урок не завершён или прошло
  больше 7 дней.
- `POST /reviews/:id/reply` - ответ репетитора; 409, если ответ уже есть.
- `GET /tutors/:id/reviews?cursor=` - отзывы, новые сверху, по 20.

## Модерация

Синхронный фильтр по словарю при записи; при совпадении - `moderation_status = hidden`, отзыв видит только автор.

## Открытый вопрос

Показывать ли скрытые отзывы репетитору. Дефолт до решения Марины - не показывать.
