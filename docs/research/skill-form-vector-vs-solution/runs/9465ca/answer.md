Готово. Изменённые/созданные файлы:

- **Models.cs** — у `Member` добавлено `FrozenUntil` (DateTime? UTC, null = активен).
- **ScheduleService.cs** — `FreezeAsync`/`UnfreezeAsync`; проверка заморозки в `EnrollAsync` (бросает `MembershipFrozenException`); `GetRandomSessionForAuditAsync` + DTO `RandomSessionDto` для «тайного гостя».
- **Program.cs** — эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`; в `/enroll` добавлен catch на `MembershipFrozenException` → 409.
- **TurnstileWorker.cs** — при заморозке на момент прохода запись остаётся «Booked», в `TurnstilePass.Note` пишется «абонемент заморожен».
- **_answer.md** — записан этот же ответ.

Решения: заморозка хранится одним полем-меткой окончания (старт всегда «сейчас»); случайное занятие выбирается через COUNT + случайный Skip с проекцией в DTO (без лишних колонок/трекинга); 409 реализован через точечный catch выделенного исключения, не трогая остальную обработку ошибок в минимальном API без глобального exception-mapping.