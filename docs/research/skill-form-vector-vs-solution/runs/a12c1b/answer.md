Ревью MR !87 готово: 1 critical, 7 high, 2 medium и 4 low. Тот же текст записан в `/home/mmx/.cache/research/runs/a12c1b/work/_answer.md`. Код я не менял, сборку и тесты не запускал.

# Ревью MR !87: экспертиза заявок, рейтинг и выгрузка для совета

## Critical

### 1. `Controllers/ContestsController.cs`: `Ranking`, `RankingCsv` открыты экспертам
Чтобы эксперт видел `GET /api/contests/{id}`, роль `Expert` добавили в `[Authorize(Roles = Coordinator + "," + Expert)]` **на уровне класса**. Поэтому `GET {id}/ranking` и `GET {id}/ranking.csv` теперь тоже доступны любому эксперту. Своего `[Authorize(Roles = Coordinator)]` у них нет, он есть только у `CloseReview`. Эксперт получает средние баллы, число экспертиз по всем заявкам и распределение грантов, причём ещё во время экспертизы. Это нарушает слепую экспертизу. По MR рейтинг смотрят только координатор и совет. Как исправить: на класс поставить `Coordinator`, а роль `Expert` разрешить только на `Get`. Или повесить `[Authorize(Roles = Coordinator)]` на оба метода рейтинга.

## High

### 2. `Services/ConflictOfInterest.cs`: `Find` не проверяет организацию эксперта
По п. 4.3 положения (комментарий в `Models/Expert.cs`) эксперт не оценивает заявки, поданные им лично **или организацией, в которой он работает**. Сейчас проверяется только `a.ApplicantId == expert.Id`, а `OrganizationInn` эксперта и заявки не сравнивается. Заявку от организации эксперта ему назначат без ошибки. MR обещает, что «конфликт интересов система проверяет сама», поэтому координатор больше не будет проверять это вручную. Нужно добавить `|| a.OrganizationInn == expert.OrganizationInn`, исключив пустой ИНН. Это касается и `AssignAsync`, и `ReassignAsync`.

### 3. `Models/Contest.cs`: `AcceptsReviews` закрывает приём на сутки раньше
`utcNow < ReviewDeadline.ToDateTime(TimeOnly.MinValue, Utc)`: это начало дня дедлайна (00:00 UTC, то есть 03:00 МСК). `ReviewDeadline` описан как «последний день приёма оценок», и по MR приём закрывается *после* дня дедлайна. Сейчас в сам день дедлайна оценки уже не принимаются. А эксперты традиционно досылают их именно в последний вечер, так что в этот вечер они получат 409 «Приём оценок закрыт». Граница должна быть `ReviewDeadline.AddDays(1)` в часовом поясе фонда (Europe/Moscow), переведённом в UTC.

### 4. `Services/RankingService.cs`: `BuildAsync` при равном балле сортирует по `CreatedAt`, а не по дате подачи
По положению при равном балле выше заявка, *поданная* раньше, а это `SubmittedAt`. В коде стоит `ThenBy(x => x.CreatedAt)`, то есть дата создания черновика в личном кабинете. Черновик, созданный раньше, мог быть подан позже. На границе фонда из-за этого грант получит не та заявка. Нужно `ThenBy(x => x.SubmittedAt)`. Для детерминированности можно добавить `ThenBy(x => x.Id)`.

### 5. `Services/RankingCsvWriter.cs`: `Write` пишет числа в культуре ru-RU, колонки съезжают
`Program.cs` ставит `ru-RU` как культуру запроса (`UseRequestLocalization`). В строке CSV `{r.Score}` и `{r.RequestedAmount}` через интерполяцию форматируются по текущей культуре: `85,33`, `1500000,00`. Эти значения не экранируются, и запятая становится разделителем полей. Строка получает лишние колонки, Google Sheets и скрипт фонда читают «Балл», «Экспертиз», «Запрошено», «Грант» со сдвигом. Числа нужно форматировать через `CultureInfo.InvariantCulture`, например `r.Score.ToString(CultureInfo.InvariantCulture)`, или собирать строку целиком через `string.Create(CultureInfo.InvariantCulture, ...)`.

### 6. `Services/AssignmentService.cs`: `ReassignAsync` передаёт новому эксперту черновик прежнего
Переназначаются ревью в статусе `Assigned` **и `Draft`**, но меняются только `ExpertId`/`ExpertName`. `Scores`, `Comment`, `Total` и `Status = Draft` остаются от выбывшего эксперта. Новый эксперт откроет `GET /api/reviews/{id}` и увидит чужие баллы и комментарий. Так он узнаёт оценку коллеги, и его собственная оценка может оказаться отправкой чужого черновика. При передаче нужно сбрасывать черновик: удалить `Scores`, обнулить `Comment` и `Total`, поставить `Status = Assigned`.

### 7. `Controllers/ReviewsController.cs`: `Mine` выполняет параллельные запросы на одном DbContext
`itemsTask` (`ToListAsync`) и `submittedTask` (`CountAsync`) запускаются одновременно и ждутся через `Task.WhenAll`, а `DbContext` один. Это запрещено: EF бросает `InvalidOperationException: A second operation was started on this context instance...`. Список «мои назначения» будет регулярно падать с 500. Запросы нужно выполнять последовательно через `await`. А `Submitted` проще посчитать по уже загруженному `items`.

### 8. `Controllers/ApplicationsController.cs`: `Search` — нетранслируемое условие по региону
`a.Region.Equals(r, StringComparison.OrdinalIgnoreCase)`: EF Core 8 / Npgsql не переводит перегрузку `string.Equals` с `StringComparison` в SQL. Запрос с параметром `region` будет падать с `InvalidOperationException` (could not be translated). Поиск по региону, заявленный в MR, не работает. Варианты: `EF.Functions.ILike(a.Region, r)` (с экранированием `%`/`_`), `a.Region.ToLower() == r.ToLower()`, или колонка `citext` / недетерминированная коллация.

## Medium

### 9. `Services/ReviewService.cs`: `SaveAsync` (и `ContestsController.CloseReview`) — нет защиты от параллельной правки ревью
У `Review` нет concurrency token (например, `xmin` через `UseXminAsConcurrencyToken` или `[Timestamp]`), явной транзакции с блокировкой тоже нет. Сценарии:
- Эксперт нажал «Отправить» в одной вкладке и «Сохранить черновик» в другой. Оба запроса прочитали `Draft`, последний записал `Status = Draft` поверх `Submitted`. Отправленная оценка снова становится черновиком и выпадает из рейтинга. При этом её коллекция `Scores` заменяется.
- Координатор закрывает экспертизу (`ExecuteUpdate` → `Expired`), пока выполняется `SaveAsync`, который уже проверил `AcceptsReviews`. Сохранение эксперта молча перезапишет `Expired` на `Submitted`/`Draft` после закрытия.
- `ReassignAsync` поменял `ExpertId`, а прежний эксперт в это время сохраняет черновик и перезаписывает строку.

Нужен concurrency token на `Review` и обработка `DbUpdateConcurrencyException` (ответ 409).

### 10. `Services/RankingCsvWriter.cs`: `Escape` — CSV/formula injection
`Title` и `ApplicantName` вводит заявитель, а CSV открывают в Google Sheets. Значение вида `=IMPORTXML(...)` / `=HYPERLINK(...)` / `+...` / `-...` / `@...` выполнится как формула у членов совета. Значения, начинающиеся с `=`, `+`, `-`, `@`, `\t`, `\r`, нужно экранировать (префикс `'`) и брать в кавычки.

## Low

### 11. `Services/AssignmentService.cs`: `AssignAsync` — гонка на уникальном индексе и закрытый конкурс
- Проверка `alreadyAssigned` и вставка не атомарны. Два параллельных назначения одной пачки упрутся в уникальный индекс `(ApplicationId, ExpertId)`, и `DbUpdateException` уйдёт клиенту как 500, а не 409. Нужно ловить нарушение уникальности (`PostgresException` 23505).
- Не проверяется, что конкурс существует и экспертиза не закрыта (`ReviewClosed`). После закрытия можно назначить новые `Assigned`, которые уже никогда не истекут и не будут приняты.

### 12. `Services/RankingService.cs`: `BuildAsync` — сортировка по неокруглённому баллу при выводе округлённого
Порядок строится по точному среднему, а в рейтинге и CSV балл выводится с округлением до 2 знаков. Две заявки с одинаковым видимым баллом (85,33) могут стоять в порядке, обратном дате подачи. Совету это не объяснить «равенством баллов по положению». Если по положению балл округляется до 2 знаков, сортировать нужно по округлённому значению (`Math.Round` транслируется в `round`).

### 13. `Services/ReviewService.cs`: `SaveAsync` — две коллекции в одном Include без явного режима
В одном запросе загружаются `Scores` и `Application.Contest.Criteria`. Это две коллекции, `QuerySplittingBehavior` не задан ни на запросе, ни глобально, и EF пишет предупреждение о декартовом произведении. Нужно явно указать `AsSplitQuery()` или `AsSingleQuery()`. Заодно: `Contest` и `Criteria` загружаются в трекинг, хотя не меняются. Это некритично, но критерии лучше получить отдельной проекцией без трекинга.

### 14. Миграции
MR меняет модель: `Contest.ReviewDeadline`/`ReviewClosed`, `Review`, `ReviewScore`, `Expert`, индексы. Миграции среди изменённых файлов нет. Перед мерджем нужно убедиться, что миграция существует и проверена (с переносом данных, если меняется место хранения). Без неё сервис упадёт на отсутствующих колонках или таблицах.