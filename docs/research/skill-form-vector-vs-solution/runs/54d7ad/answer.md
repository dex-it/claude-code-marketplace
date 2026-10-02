Готово! Реализовал все 4 задачи:

**Файлы изменены:**
- Models.cs — добавлено `FrozenUntil` для Member
- ScheduleService.cs — методы заморозки/разморозки и случайного занятия; проверка заморозки при записи
- TurnstileWorker.cs — проверка заморозки при обработке проходов (пометка в Note)
- Program.cs — endpoints POST/DELETE для заморозки, GET для случайного занятия, обработка 409 Conflict
- StudioDbContext.cs — конфигурация timestamptz для FrozenUntil

**Решения:**
- Заморозка: FrozenUntil = UtcNow + N дней; проверка `FrozenUntil > datetime`
- Турникет пропускает засчёт если заморожен, пишет "абонемент заморожен"
- Случайное занятие из 7 дней с именами записавшихся (без отменённых), используется Include+ThenInclude и AsNoTracking согласно SKILL.md