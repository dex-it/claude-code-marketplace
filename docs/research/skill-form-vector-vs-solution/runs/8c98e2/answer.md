Нашёл 9 дефектов. Самый опасный — в расчёте дозы препарата: объём выходит в 1000 раз больше нужного. Код не менял, сборку и тесты не запускал. Ниже тот же текст, что в `_answer.md`.

# Ревью MR !231 «Процедурный кабинет»

**1. `Services/ProcedureService.cs` — `CalculateDoseMlAsync`: граммы подставлены как килограммы — critical**
- Код считает `doseMg = weightGrams * drugMgPerKg`. Формула из комментария требует вес **в кг**, а `Pet.WeightGrams` хранит его в граммах.
- Объём получается в 1000 раз больше. Пример: кот весом 4 кг (4000 г), 2.5 мг/кг, 10 мг/мл → 1000 мл вместо 1 мл.
- Это ошибка в расчёте дозы для живого пациента.
- Как исправить: `weightGrams / 1000m * drugMgPerKg`.

**2. `Domain/Pet.cs` / `Services/ProcedureService.cs` — `WeightGrams` не nullable, при нулевом весе доза 0 — high**
- `WeightGrams` объявлен как `int` (NOT NULL), поэтому миграция проставит 0 всем уже существующим питомцам.
- Для невзвешенных питомцев `CalculateDoseMlAsync` молча вернёт 0 мл вместо ошибки «вес неизвестен».
- Как исправить: сделать поле `int?` и бросать исключение, если вес не задан или ≤ 0.

**3. `Services/ProcedureSheetService.cs` — `GetDaySheetAsync`: пагинация с 0, а по контракту с 1 — high**
- По контракту страницы нумеруются с 1, а в коде `Skip(page * PageSize)`. Запрос `page=1` пропускает первые 30 процедур дня, и персонал не увидит утренние записи.
- Проверки `page >= 1` нет: при отрицательном `page` будет исключение (500).
- Как исправить: `Skip((page - 1) * PageSize)` плюс проверка `page`.

**4. `Services/ProcedureSheetService.cs` — `SearchNotesAsync`: не ищет по заметкам персонала — medium**
- Запрос смотрит только в `Procedures.Notes`. Заметки персонала хранятся в отдельной таблице `StaffNotes`, и по ним поиск ничего не находит.
- GIN-индекса по `to_tsvector('russian', ...)` нет, поэтому каждый поиск сканирует всю таблицу.
- Как исправить: добавить `EXISTS` по `StaffNotes` и индекс.

**5. `Data/ClinicDbContext.cs` — `OnModelCreating`: каскадное удаление от `Pet` — medium**
- `Procedure.PetId` — обязательный FK, и EF по умолчанию ставит каскад на всю цепочку Pet → Procedures → ConsumableLines/StaffNotes.
- При удалении питомца пропадут и закрытые процедуры вместе со списанием расходников. README это запрещает, а отчёт по расходу задним числом изменится.
- Как исправить: `OnDelete(DeleteBehavior.Restrict)`.

**6. `Services/ProcedureService.cs` — `RemoveConsumableAsync`: гонка с закрытием процедуры — medium**
- Статус проверяется отдельно от удаления, без concurrency token (`xmin`) и без блокировки.
- Если процедуру закроют между проверкой и `SaveChanges`, строка удалится уже из закрытого списания.
- Как исправить: concurrency token на `Procedure` или одним условным `DELETE`, который проверяет статус.
- Попутно: метод загружает все расходники процедуры (их бывают сотни) ради удаления одной строки.

**7. `Services/ProcedureService.cs` — `ScheduleAsync`: нет валидации входных данных — low**
- `Title == null` → NullReferenceException (500).
- Длина `Title` больше 200 не проверяется, ошибка приходит из БД.
- Несуществующий `PetId` → FK violation (500) вместо 400/404.

**8. `Services/ProcedureService.cs` — `GetCardAsync`: расходники без сортировки — low**
- `Consumables` выводятся без `OrderBy`, а при split query порядок строк не гарантирован. В карточках с сотнями строк порядок будет меняться от запроса к запросу.
- Как исправить: `OrderBy(c => c.Id)`.

**9. `Services/ProcedureService.cs` — `ScheduleAsync`/`RescheduleAsync`: время со смещением сдвигается — low**
- Если клиент всё-таки пришлёт время со смещением (`+03:00`), System.Text.Json пересчитает его в пояс сервера (`Kind=Local`).
- После `SpecifyKind` в БД попадёт сдвинутое настенное время.
- Как исправить: отклонять значения с `Kind != Unspecified`.