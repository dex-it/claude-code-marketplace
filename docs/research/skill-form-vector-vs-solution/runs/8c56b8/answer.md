Готово! Реализовал все четыре задачи по управлению абонементами и сервису студии:

## Созданные/изменённые файлы:
- **Models.cs** — добавлено `FrozenUntil: DateTime?` для отслеживания заморозки
- **ScheduleService.cs** — методы `FreezeAsync`, `UnfreezeAsync`, `GetRandomSessionAsync`; проверка заморозки в `EnrollAsync`
- **TurnstileWorker.cs** — проверка заморозки при засчитывании проходов
- **Program.cs** — endpoints `POST /members/{id}/freeze`, `DELETE /members/{id}/freeze`, `GET /quality/random-session`; обработка 409 при замороженном абонементе
- **Migrations/20261002000000_AddFrozenUntilToMember.cs** — миграция БД

## Решения:
- **(а)** Endpoints заморозки с сохранением в `FrozenUntil`; снятие досрочно очищает дату.
- **(б)** TurnstileWorker при проходе проверяет заморозку и оставляет пометку "абонемент заморожен" в журнале, запись остаётся `Booked`.
- **(в)** `GET /quality/random-session` выбирает случайное занятие из ближайших 7 дней опубликованного курса с именами неотменённых записавшихся.
- **(г)** При попытке записи на занятие с замороженным абонементом возвращается 409 Conflict.