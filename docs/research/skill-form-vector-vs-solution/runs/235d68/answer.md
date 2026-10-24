## Изменённые/созданные файлы

- `Models.cs` — у `Member` добавлены `FreezeStartsAt`/`FreezeEndsAt` (UTC-период заморозки) и метод `IsFrozenAt(DateTime)`.
- `ScheduleService.cs` — добавлено исключение `MembershipFrozenException`; в `EnrollAsync` перед проверкой мест — проверка `member.IsFrozenAt(session.StartsAt)`.
- `TurnstileWorker.cs` — перед попыткой засчитать посещение проверяется `member.IsFrozenAt(pass.PassedAt)`: если абонемент заморожен, запись остаётся «Booked», в `pass.Note` пишется «абонемент заморожен».
- `MembershipService.cs` (новый) — `FreezeAsync`/`UnfreezeAsync` для эндпоинтов заморозки.
- `QualityService.cs` (новый) — `GetRandomSessionAsync()` для «тайного гостя».
- `Program.cs` — регистрация новых сервисов, эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`, обработка 409 в `/sessions/{id}/enroll`.

## Решения

Заморозка хранится как период `[FreezeStartsAt; FreezeEndsAt]`, а не просто «заморожен сейчас» — нужно для пункта (г), где проверяется момент начала занятия в будущем. Та же проверка переиспользуется в турникет-воркере по времени прохода (пункт б). Случайное занятие выбирается через `COUNT` + `Skip(random)` вместо `ORDER BY RANDOM()`, чтобы запрос был дешёвым и целиком транслировался в SQL.