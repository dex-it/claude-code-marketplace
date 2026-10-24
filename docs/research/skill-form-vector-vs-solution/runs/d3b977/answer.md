Изменённые файлы:
- `Models.cs` — добавлено поле `Member.FrozenUntil` (DateTime?, UTC).
- `ScheduleService.cs` — `FreezeMemberAsync`/`UnfreezeMemberAsync`, проверка заморозки в `EnrollAsync` (+ `MembershipFrozenException`), `GetRandomSessionForQualityCheckAsync` + `RandomSessionDto` для «тайного гостя».
- `TurnstileWorker.cs` — проход во время заморозки не засчитывает занятие, в `Note` пишется «абонемент заморожен», запись остаётся «Booked».
- `Program.cs` — endpoints `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`, обработка 409 при записи на занятие.
- `_answer.md` — тот же отчёт.

Решения: заморозка хранится одним nullable-полем на `Member` без отдельной таблицы; случайное занятие выбирается через `COUNT` + случайный `Skip` + один проекционный запрос (без загрузки всего набора в память, согласно чек-листу EF Core); 409 реализован через точечный catch выделенного исключения в хендлере записи, не трогая остальной стиль обработки ошибок в проекте.