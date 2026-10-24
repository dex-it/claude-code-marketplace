Изменённые файлы:
- `Models.cs` — у `Member` добавлены `FreezeStart`/`FreezeEnd` и `IsFrozenAt(moment)`; добавлен `MembershipFrozenException`.
- `ScheduleService.cs` — `FreezeMemberAsync`/`UnfreezeMemberAsync`; в `EnrollAsync` проверка заморозки на момент начала занятия (409 через `MembershipFrozenException`); `GetRandomSessionAsync` + `RandomSessionDto` для «тайного гостя».
- `TurnstileWorker.cs` — перед зачётом прохода проверяется заморозка на момент `PassedAt`; если заморожен — `Note = "абонемент заморожен"`, запись остаётся `Booked`.
- `Program.cs` — новые эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`; `enroll` ловит `MembershipFrozenException` → 409.

Заморозка хранится как интервал `[FreezeStart, FreezeEnd)` прямо на `Member` — одного поля-пары хватает и для проверки в турникете (по времени прохода), и для проверки при записи (по времени начала занятия); досрочное снятие — просто обнуление полей. Для «тайного гостя» случайный `Id` занятия выбирается в памяти среди занятий ближайших 7 дней — для масштаба студии этого достаточно, без завязки на `ORDER BY random()` конкретной СУБД. Ответ продублирован в `_answer.md`.