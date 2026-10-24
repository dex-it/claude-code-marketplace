Изменённые файлы:
- **Models.cs** — добавлено `Member.FreezeUntil` (nullable DateTime, UTC) — конец заморозки абонемента.
- **ScheduleService.cs** — добавлены `FreezeMembershipAsync`/`UnfreezeMembershipAsync`, `GetRandomQualitySessionAsync` (+ DTO `RandomSessionDto`, исключение `MembershipFrozenException`); в `EnrollAsync` — проверка заморозки на момент начала занятия.
- **TurnstileWorker.cs** — при заморозке на момент прохода запись остаётся «Booked», в `Note` пишется «абонемент заморожен»; плюс `AsNoTracking()` на read-only выборке `Member`.
- **Program.cs** — эндпоинты `POST/DELETE /members/{id}/freeze`, `GET /quality/random-session`; `enroll` ловит `MembershipFrozenException` → 409.
- **_answer.md** — записан этот же отчёт.

Решения: заморозка хранится одним полем `FreezeUntil` (заморожен ⇔ момент ≤ FreezeUntil), что покрывает обе проверки (запись и турникет) без отдельного поля «начало заморозки». Случайное занятие для «тайного гостя» выбирается через `COUNT` + случайный `Skip` по отфильтрованному `IQueryable`, затем отдельный `Include`-запрос по найденному Id — без загрузки всех занятий и без риска нетривиальной трансляции `Skip`+`Include` при split query.

Сборку и тесты не запускал, как было указано.