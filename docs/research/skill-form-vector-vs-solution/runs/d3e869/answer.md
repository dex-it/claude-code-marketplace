## Готово

Реализованы все четыре задачи:

**Изменённые файлы:**
- **Models.cs** - добавлено `FrozenUntil: DateTime?` в Member
- **ScheduleService.cs** - методы FreezeAsync, UnfreezeAsync, GetRandomSessionAsync; проверка заморозки при записи
- **TurnstileWorker.cs** - пропуск засчитывания при заморозке с пометкой в журнал
- **Program.cs** - endpoints `/members/{id}/freeze`, `/members/{id}/freeze` (DELETE), `/quality/random-session`

**Решение:** заморозка хранится как FrozenUntil на Member; при записи и обработке проходов проверяется срок — если абонемент заморожен к моменту события, запись не создаётся (409) или проход не засчитывается; "тайный гость" выбирает случайное опубликованное занятие из ближайших 7 дней с полной информацией об участниках.

Ответ записан в `_answer.md`.