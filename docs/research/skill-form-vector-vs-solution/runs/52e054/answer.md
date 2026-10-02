Готово.

**Изменённые файлы:**
- `Models.cs` — у `Member` добавлено поле `FrozenUntil` (UTC, nullable) и метод `IsFrozenAt(DateTime)`.
- `ScheduleService.cs` — `FreezeMembershipAsync`/`UnfreezeMembershipAsync`; проверка заморозки в `EnrollAsync` (409 через новый `MembershipFrozenException`); `GetRandomSessionForQualityCheckAsync` для «тайного гостя».
- `Program.cs` — эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`; в `/sessions/{id}/enroll` добавлен перехват `MembershipFrozenException` → 409.
- `TurnstileWorker.cs` — перед зачётом посещения проверяется `member.IsFrozenAt(pass.PassedAt)`; при заморозке запись остаётся `Booked`, в `Note` пишется «абонемент заморожен».

**Решения:**
- Заморозка — одно поле `FrozenUntil`; «заморожен» = `FrozenUntil > момент проверки`, единая логика переиспользуется и в турникете, и при записи на занятие.
- Случайное занятие выбирается в 2 шага: сначала в БД берутся только id подходящих по дате занятий, случайный выбор — в коде, затем один запрос с filtered Include (без отменённых) и `AsNoTracking`.
- Миграции не создавал — в проекте нет каталога Migrations/инфраструктуры EF, а запускать `dotnet ef` было запрещено условиями задачи.

Тот же текст сохранён в `_answer.md`.