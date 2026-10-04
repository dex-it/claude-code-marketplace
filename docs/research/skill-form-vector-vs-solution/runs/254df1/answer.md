## Изменённые/созданные файлы

- `Models.cs` — у `Member` добавлено поле `FrozenUntil` (DateTime?, UTC) и метод `IsFrozenAt(DateTime at)`.
- `ScheduleService.cs` — добавлены `MembershipFrozenException`, `RandomSessionDto`, методы `FreezeAsync`/`UnfreezeAsync`, `GetRandomSessionForAuditAsync`; в `EnrollAsync` добавлена проверка заморозки на момент начала занятия.
- `TurnstileWorker.cs` — при обработке прохода, если абонемент заморожен на момент прохода, запись о занятии не меняется, в `TurnstilePass.Note` пишется «абонемент заморожен».
- `Program.cs` — добавлены `POST /members/{id}/freeze`, `DELETE /members/{id}/freeze`, `GET /quality/random-session`; `POST /sessions/{id}/enroll` теперь возвращает 409 при заморозке.

## Решения

Заморозка хранится одним полем `FrozenUntil`, активность в любой момент проверяется сравнением `FrozenUntil > at` — работает и для записи (момент начала занятия), и для турникета (момент прохода); досрочное снятие — просто `FrozenUntil = null`. Турникет при заморозке не трогает статус записи, только помечает журнал прохода. Для 409 введено отдельное исключение, перехватываемое только в эндпоинте записи, чтобы не менять поведение остального кода. Тот же текст сохранён в `work/_answer.md`.