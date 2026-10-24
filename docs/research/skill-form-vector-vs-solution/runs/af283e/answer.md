Изменённые/созданные файлы:
- `Models.cs` — у `Member` добавлено поле `FrozenUntil` (UTC, nullable).
- `ScheduleService.cs` — `FreezeMemberAsync`/`UnfreezeMemberAsync`, проверка заморозки в `EnrollAsync` (409 через `MembershipFrozenException`), `GetRandomSessionForQualityCheckAsync`, DTO `RandomSessionDto`.
- `Program.cs` — эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`, обработка 409 в эндпоинте записи.
- `TurnstileWorker.cs` — при заморозке на момент прохода посещение не засчитывается, запись остаётся «Booked», в `Note` — «абонемент заморожен».
- `_answer.md` — тот же ответ.

Решения: заморозка хранится одним полем `FrozenUntil`, статус «заморожен в момент X» проверяется единообразно и в турникете, и при записи (`FrozenUntil >= X`), что само снимается по истечении срока или досрочной разморозке; случайное занятие для «тайного гостя» выбирается через выборку id за 7 дней + `Random.Shared`, затем один запрос с filtered Include для деталей и списка записавшихся.