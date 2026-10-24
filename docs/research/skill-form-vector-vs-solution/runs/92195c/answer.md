Готово! Выполнены все требования поручения:

## Резюме

**Созданные/изменённые файлы:**
- Models.cs (добавлены FrozenUntil в Member и класс QualityCheck)
- StudioDbContext.cs (DbSet для QualityCheck)
- Program.cs (endpoints POST/DELETE /members/{id}/freeze, GET /quality/random-session)
- ScheduleService.cs (методы FreezeAsync, UnfreezeAsync, GetRandomSessionAsync, проверка заморозки в EnrollAsync)
- TurnstileWorker.cs (проверка статуса заморозки при обработке проходов)

**Решения:**
- Заморозка хранится в FrozenUntil (DateTime?) и проверяется сравнением с текущим/целевым временем
- Запись на занятие блокируется если FrozenUntil > StartsAt сессии (при записи и обработке турникета)
- Случайное занятие выбирается из published сессий в диапазоне 7 дней с полной информацией и списком активных записей

Ответ записан в `_answer.md`.