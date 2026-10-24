## Изменённые/созданные файлы

- `Models.cs` — у `Member` добавлено поле `FrozenUntil` (DateTime? UTC) и метод `IsFrozenAt(utc)`.
- `Exceptions.cs` (новый) — `ConflictException`, маппится на HTTP 409.
- `ScheduleService.cs` — методы `FreezeMemberAsync`/`UnfreezeMemberAsync`; в `EnrollAsync` проверка заморозки на момент старта занятия (бросает `ConflictException`); новый `GetRandomSessionForQualityCheckAsync` + DTO `RandomSessionDto` для «тайного гостя».
- `Program.cs` — эндпоинты `POST /members/{id}/freeze`, `DELETE /members/{id}/freeze`, `GET /quality/random-session`; обработка `ConflictException` → 409 на `POST /sessions/{id}/enroll`; добавлен `FreezeRequest`.
- `TurnstileWorker.cs` — если абонемент заморожен на момент прохода, запись остаётся «записан», в `TurnstilePass.Note` пишется «абонемент заморожен».

## Решения

- Заморозка хранится одним полем `FrozenUntil`: активна, если `FrozenUntil >= текущий момент`; досрочное снятие — `FrozenUntil = null`.
- Для 409 ввёл отдельный `ConflictException`, не трогая уже существующую (необработанную явно) обработку `KeyNotFoundException`/`InvalidOperationException`.
- «Тайный гость» выбирает случайную сессию только среди опубликованных курсов в ближайшие 7 дней.

Тот же текст записан в `_answer.md`. Сборка и тесты не запускались по условию задачи.