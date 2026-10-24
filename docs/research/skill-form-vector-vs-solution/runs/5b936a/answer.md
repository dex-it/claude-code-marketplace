Готово! Реализовал все 4 задачи:

**Изменённые файлы:**

1. **Models.cs** — добавлено `DateTime? FrozenUntil` в Member
2. **ScheduleService.cs** — добавлены `RandomSessionDto`, проверка заморозки в `EnrollAsync` и метод `GetRandomSessionAsync()`
3. **TurnstileWorker.cs** — проверка заморозки перед засчитыванием прохода
4. **Program.cs** — 3 новых endpoint и DTO FreezeRequest

**Решение:**
- Заморозка хранится в `FrozenUntil` (UTC). Турникет не засчитывает проход, если `FrozenUntil > PassedAt`, с пометкой "абонемент заморожен".
- Запись на занятие блокируется 409 Conflict, если абонемент заморожен до `session.StartsAt`.
- "Тайный гость" — случайное опубликованное занятие из 7 дней с курсом, тренером, залом и списком записавшихся.