Изменённые файлы:
- `Models.cs` — у `Member` добавлены `FrozenFrom`/`FrozenUntil` (UTC) и `IsFrozenAt(moment)`.
- `ScheduleService.cs` — `FreezeMemberAsync`/`UnfreezeMemberAsync`, проверка заморозки в `EnrollAsync` (409 через `MemberFrozenException`), `GetRandomSessionForQualityCheckAsync` + `QualityCheckDto`.
- `TurnstileWorker.cs` — проход во время заморозки не засчитывает занятие, в `Note` пишется «абонемент заморожен».
- `Program.cs` — эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`, обработка 409 в `/sessions/{id}/enroll`, `record FreezeRequest`.

Решения: заморозка хранится как интервал на самом `Member` (без истории), один предикат `IsFrozenAt` используется и для прохода турникета (по времени прохода), и для проверки записи на занятие (по времени начала). «Тайный гость» — случайный выбор без персистентности: при каждом вызове выбирается случайное занятие из ближайших 7 дней, частоту вызова (раз в неделю) контролирует управляющий. Тот же текст сохранён в `_answer.md`.