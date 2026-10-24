Выполнено. Сборку и тесты не запускал, как было указано.

## Изменённые файлы
- `Models.cs` — у `Member` добавлены `FreezeStartAt`/`FreezeEndAt` и метод `IsFrozenAt(DateTime at)`.
- `ScheduleService.cs` — `FreezeMemberAsync`, `UnfreezeMemberAsync`, `GetRandomSessionForQualityCheckAsync`, `RandomSessionDto`, `MembershipFrozenException`; в `EnrollAsync` — проверка заморозки на момент начала занятия.
- `Program.cs` — эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`; `enroll` ловит `MembershipFrozenException` → 409.
- `TurnstileWorker.cs` — если абонемент заморожен на момент прохода, запись не засчитывается, в `Note` пишется «абонемент заморожен».

## Решения
Заморозка хранится как интервал `[FreezeStartAt, FreezeEndAt]` прямо на `Member` — без доп. таблиц и фоновых джобов, срок "сгорает" сам по дате. Один и тот же метод `IsFrozenAt` используется и для прохода турникета, и для проверки при записи — гарантирует одинаковую семантику. "Тайный гость" выбирает случайное занятие в два шага: сначала ID в окне 7 дней, затем `Random.Shared` и подгрузка деталей — чтобы не тащить в память весь граф объектов.

Тот же текст сохранён в `_answer.md`.