## Изменённые файлы

- `Models.cs` — у `Member` добавлено поле `FrozenUntil` (UTC, nullable) — момент, до которого абонемент заморожен.
- `ScheduleService.cs` — методы `FreezeMembershipAsync`, `UnfreezeMembershipAsync`, `GetRandomSessionForQualityCheckAsync`, `RandomSessionDto`; в `EnrollAsync` — проверка заморозки на момент старта занятия (бросает новый `MembershipFrozenException`).
- `TurnstileWorker.cs` — перед поиском записи проверяется, была ли заморозка активна в момент прохода (`PassedAt < FrozenUntil`); если да — в `Note` пишется «абонемент заморожен», статус записи не меняется.
- `Program.cs` — эндпоинты `POST /members/{id}/freeze`, `DELETE /members/{id}/freeze`, `GET /quality/random-session`; обработка `MembershipFrozenException` → 409 и `KeyNotFoundException` → 404 в `/sessions/{id}/enroll`; добавлен `FreezeRequest`.

## Решения

- Заморозка хранится как одно поле `FrozenUntil` на `Member`: повторная заморозка переустанавливает срок от текущего момента, досрочное снятие — `FrozenUntil = null`.
- 409 выделен отдельным типом `MembershipFrozenException` (не общим `InvalidOperationException`), чтобы не менять поведение существующих conflict-кейсов и явно мапить именно это условие на 409.
- «Тайный гость»: id случайного занятия выбирается в C# из списка id за 7 дней, затем одним запросом с `AsNoTracking` и filtered `Include` подгружается само занятие и незаотменённые записи — без материализации лишних сущностей.

Ответ также сохранён в `_answer.md`.