## Готово! 

**Реализованные файлы:**
- `Models.cs` — добавлено поле `FrozenUntil` (DateTime?) в Member
- `ScheduleService.cs` — методы `FreezeAsync`, `UnfreezeAsync`, `GetRandomSessionAsync`, проверка заморозки в `EnrollAsync`
- `TurnstileWorker.cs` — проверка заморозки: если FrozenUntil > время прохода, пометка "абонемент заморожен"
- `Program.cs` — endpoints POST/DELETE `/members/{id}/freeze` и GET `/quality/random-session`

**Решения:** Заморозка хранится как UTC datetime; при замороженном абонементе запись на занятие возвращает 409, проходы через турникет не засчитываются; endpoint рандома выбирает занятие из 7 дней вперёд с информацией о записавшихся клиентах.