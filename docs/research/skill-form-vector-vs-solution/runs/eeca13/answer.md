## Изменённые файлы

- `Models.cs` — у `Member` добавлено поле `FreezeUntil` (`DateTime?`, timestamptz, пишется только Kind=Utc).
- `ScheduleService.cs` — добавлены `MembershipFrozenException`, `RandomSessionDto`, методы `FreezeMemberAsync`, `UnfreezeMemberAsync`, `GetRandomQualitySessionAsync`; в `EnrollAsync` добавлена проверка заморозки на момент старта занятия (409).
- `TurnstileWorker.cs` — перед поиском записи проверяется, была ли заморозка активна в момент `PassedAt`; если да — запись не меняется, в `Note` пишется «абонемент заморожен» (запрос `Member` переведён на `AsNoTracking`, т.к. сущность не меняется).
- `Program.cs` — эндпоинты `POST /members/{id}/freeze`, `DELETE /members/{id}/freeze`, `GET /quality/random-session`; у `/sessions/{id}/enroll` добавлен перехват `MembershipFrozenException` → 409.

## Решения

Заморозка хранится одним полем `FreezeUntil` (начало не нужно отдельно, т.к. заморозка всегда стартует «сейчас», что всегда раньше будущего занятия/прохода). «Тайный гость» выбирается без `ORDER BY random()`: `CountAsync` по отфильтрованному в SQL набору (7 дней, опубликованные курсы), затем `Skip(случайный индекс).Take(1)` с проекцией в DTO. Для 409 введено отдельное исключение `MembershipFrozenException`, перехватываемое точечно в эндпоинте записи — по аналогии с существующим стилем проекта.

Тот же текст записан в `_answer.md`.