## Изменённые файлы

- `Models.cs` — у `Member` добавлено поле `FreezeUntil` (DateTime?, UTC) и метод `IsFrozenAt(DateTime at)`.
- `ScheduleService.cs` — добавлены `FreezeMemberAsync`, `UnfreezeMemberAsync`, `GetRandomQualitySessionAsync`, `QualitySessionDto`, исключение `MembershipFrozenException`; в `EnrollAsync` добавлена проверка заморозки на момент начала занятия.
- `TurnstileWorker.cs` — при заморозке абонемента на момент прохода (`PassedAt`) занятие не засчитывается: запись остаётся `Booked`, в `TurnstilePass.Note` пишется «абонемент заморожен».
- `Program.cs` — добавлены `POST /members/{id}/freeze`, `DELETE /members/{id}/freeze`, `GET /quality/random-session`; `POST /sessions/{id}/enroll` ловит `MembershipFrozenException` и отдаёт 409.

## Решения

- Заморозка хранится одним полем `FreezeUntil` без истории периодов — этого достаточно, нужен только статус на конкретный момент времени.
- Проверка заморозки берётся относительно времени события (`PassedAt` для турникета, `Session.StartsAt` для записи), а не момента обработки — это корректно при отложенной обработке проходов и записи заранее.
- «Тайный гость»: кандидаты — занятия опубликованных курсов в окне `[UtcNow, UtcNow+7d]`, случайный выбор по id, затем детали с фильтрованным `Include` записей (без отменённых).

Тот же текст записан в `/home/mmx/.cache/research/runs/451d77/work/_answer.md`.