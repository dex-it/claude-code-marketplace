Изменённые файлы:
- `Models.cs` — добавлено поле `Member.FrozenUntil` (DateTime? UTC, null = не заморожен).
- `ScheduleService.cs` — `FreezeMemberAsync`/`UnfreezeMemberAsync`; проверка заморозки на момент старта занятия в `EnrollAsync` (бросает `MembershipFrozenException`); `GetRandomSessionForAuditAsync` + DTO `RandomSessionDto` для «тайного гостя».
- `TurnstileWorker.cs` — если абонемент заморожен на момент прохода, запись остаётся «Booked», а в `pass.Note` пишется «абонемент заморожен».
- `Program.cs` — эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`, маппинг `MembershipFrozenException` на 409 в `/sessions/{id}/enroll`; добавлен `FreezeRequest`.

Решения: заморозка хранится одним полем `FrozenUntil` (т.к. freeze всегда стартует «сейчас», `FrozenUntil > t` однозначно определяет заморожен ли клиент в момент t — переиспользуется и для турникета, и для записи); случайное занятие выбирается через `COUNT` + случайный `Skip` в SQL, чтобы не тянуть всю таблицу. Миграцию под новую колонку не создавал — в репозитории нет csproj/Migrations для `dotnet ef`, нужно сгенерировать отдельно. Тот же текст сохранён в `work/_answer.md`.