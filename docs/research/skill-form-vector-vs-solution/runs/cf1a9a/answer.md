Изменённые/созданные файлы:
- `Models.cs` — у `Member` добавлено поле `FrozenUntil` (UTC, nullable) и метод `IsFrozenAt(DateTime)`.
- `ScheduleService.cs` — методы `FreezeMemberAsync`/`UnfreezeMemberAsync`; в `EnrollAsync` проверка заморозки на момент начала занятия (бросает `MembershipFrozenException`); метод `GetRandomSessionForAuditAsync` для «тайного гостя»; DTO `RandomSessionDto`.
- `Program.cs` — эндпоинты `POST /members/{id}/freeze`, `DELETE /members/{id}/freeze`, `GET /quality/random-session`; маппинг `MembershipFrozenException` на 409 в `/sessions/{id}/enroll`; record `FreezeRequest`.
- `TurnstileWorker.cs` — если абонемент заморожен на момент прохода, запись остаётся «записан», в `TurnstilePass.Note` пишется «абонемент заморожен», статус не меняется.
- `_answer.md` — тот же отчёт.

Решения: заморозка хранится одним полем `FrozenUntil` (заморожен = момент < FrozenUntil), unfreeze снимает её досрочно. Случайное занятие для «тайного гостя» выбирается в два шага — сначала id из ближайших 7 дней без полной материализации, потом один запрос с `AsNoTracking` и filtered `Include` для данных и записавшихся без отменённых. 409 реализован через выделенное исключение, перехватываемое только на эндпоинте записи, не затрагивая остальную обработку ошибок.