Изменённые/созданные файлы:
- `Models.cs` — у `Member` добавлены `FrozenFrom`/`FrozenUntil` (UTC) и метод `IsFrozenAt(momentUtc)`.
- `Exceptions.cs` (новый) — `MembershipFrozenException` для 409 при записи на занятие в период заморозки.
- `ScheduleService.cs` — `FreezeAsync`/`UnfreezeAsync`, проверка заморозки в `EnrollAsync`, `GetRandomQualityCheckSessionAsync` + `QualityCheckDto` для «тайного гостя».
- `TurnstileWorker.cs` — при заморозке абонемента запись остаётся `Booked`, в `TurnstilePass.Note` пишется «абонемент заморожен».
- `Program.cs` — эндпоинты `POST`/`DELETE /members/{id}/freeze`, `GET /quality/random-session`, обработка `MembershipFrozenException` → 409 на `/sessions/{id}/enroll`.

Решения: заморозка — интервал `[FrozenFrom, FrozenUntil)` в UTC с единым методом проверки `IsFrozenAt`, используемым и при записи (момент начала занятия), и в турникет-воркере (момент прохода). Для «тайного гостя» id занятий за 7 дней материализуются списком, случайный выбор делается в памяти, после чего одним проекционным запросом (без `Include`, `AsNoTracking`) подтягиваются только нужные поля и ФИО записавшихся без отменённых.

Тот же текст записан в `/home/mmx/.cache/research/runs/af2854/work/_answer.md`.