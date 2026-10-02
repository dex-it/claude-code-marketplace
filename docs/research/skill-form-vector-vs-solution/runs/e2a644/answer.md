✅ Готово! Реализовал все 4 задачи:

**Созданные/изменённые файлы:**
- Models.cs — добавлена `MemberFreeze` для отслеживания заморозок
- StudioDbContext.cs — конфигурация с FK Cascade  
- ScheduleService.cs — методы `FreezeAsync`, `UnfreezeAsync`, `GetRandomSessionAsync` и проверка при записи
- TurnstileWorker.cs — проверка заморозки в обработчике проходов
- Program.cs — endpoints POST/DELETE /members/{id}/freeze и GET /quality/random-session

**Решения:**
- **Замораживание**: отношение 1:1 Member↔MemberFreeze с FrozenUntil (UTC), проверка при записи (409 Conflict) и проходе (пометка "абонемент заморожен", запись остаётся "записан").
- **Тайный гость**: случайное занятие из 7 дней с использованием `EF.Functions.Random()` и проекцией только нужных полей (курс, тренер, зал, время, имена активных участников).