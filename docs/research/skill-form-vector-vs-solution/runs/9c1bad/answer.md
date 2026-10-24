Нашёл 11 дефектов: 1 critical, 6 high, 2 medium, 2 low. Ответ записан в `/home/mmx/.cache/research/runs/9c1bad/work/_answer.md`. Сборку и тесты, как и договаривались, не запускал, все выводы получены чтением кода.

# Ревью MR !87 — GrantDesk: экспертиза, рейтинг, CSV

## 1. `Controllers/ContestsController.cs` — `Ranking`, `RankingCsv` (и уровень класса) — **critical**
Чтобы эксперты могли открыть `GET /api/contests/{id}`, роль `Expert` добавили в `[Authorize]` на весь класс. Вместе с карточкой конкурса экспертам открылись `GET {id}/ranking` и `GET {id}/ranking.csv`. Любой эксперт видит рейтинг со средними баллами всех заявок, число отправленных экспертиз и распределение грантов, причём ещё во время экспертизы. Это ломает слепую экспертизу, а эксперт может подогнать свою оценку под текущий рейтинг. По MR рейтинг смотрят только координатор и совет.
Как исправить: на классе оставить `Coordinator`, а роль `Expert` разрешить только на методе `Get`.

## 2. `Services/ConflictOfInterest.cs` — `Find` — **high**
Конфликт ищется только по `a.ApplicantId == expert.Id`. Вторую половину правила (п. 4.3 положения, описан в `Expert.OrganizationInn`) код не проверяет: эксперт не должен оценивать заявки своей организации. Сравнения `a.OrganizationInn == expert.OrganizationInn` нет. MR обещает, что система проверяет конфликт сама и координатор перестанет делать это вручную. В итоге сотрудники организации-заявителя будут получать её заявки и через `AssignAsync`, и через `ReassignAsync`.
Как исправить: добавить условие по ИНН и игнорировать пустой ИНН.

## 3. `Models/Contest.cs` — `AcceptsReviews` — **high**
`utcNow < ReviewDeadline.ToDateTime(TimeOnly.MinValue, Utc)` закрывает приём в 00:00 UTC **в начале** дня дедлайна. По MR приём должен закрываться **после** этого дня, и эксперты досылают оценки как раз в последний вечер. Получается, что весь день дедлайна потерян. Кроме того, граница считается в UTC, а не по местному времени фонда.
Как исправить: принимать оценки до `ReviewDeadline.AddDays(1)` 00:00 по Europe/Moscow, переведённому в UTC.

## 4. `Services/RankingService.cs` — `BuildAsync` — **high**
При равном балле заявки сортируются `ThenBy(x => x.CreatedAt)`, то есть по времени создания черновика. По положению выше должна стоять заявка, **поданная** раньше, а это `SubmittedAt`. На границе бюджета из-за этого грант может получить не та заявка.
Как исправить: `ThenBy(x => x.SubmittedAt)`, третьим ключом — `Id`.

## 5. `Services/RankingCsvWriter.cs` — `Write` — **high**
`{r.Score}` и `{r.RequestedAmount}` форматируются в культуре запроса. `UseRequestLocalization` с единственной культурой `ru-RU` даёт `85,33` и `150000,00`: десятичная запятая внутри CSV с разделителем-запятой и без кавычек. Колонки разъезжаются, и Google Sheets и скрипт фонда читают данные со сдвигом.
Как исправить: форматировать числа через `CultureInfo.InvariantCulture`.

## 6. `Controllers/ReviewsController.cs` — `Mine` — **high**
`ToListAsync` и `CountAsync` запускаются параллельно через `Task.WhenAll` на одном и том же `GrantsDbContext`. EF Core выбрасывает `InvalidOperationException: A second operation was started on this context instance`, и эндпоинт отвечает 500.
Как исправить: выполнять запросы по очереди или считать `Submitted` по уже загруженному списку `items`.

## 7. `Controllers/ApplicationsController.cs` — `Search` — **high**
`a.Region.Equals(r, StringComparison.OrdinalIgnoreCase)` в EF Core 8 / Npgsql в SQL не транслируется. При любом запросе с `region` будет «could not be translated» и 500, то есть поиск по региону не работает вообще.
Как исправить: `EF.Functions.ILike` с экранированием `%`/`_`, либо `ToLower()` с обеих сторон, либо `citext` или недетерминированная collation.

## 8. `Services/AssignmentService.cs` — `ReassignAsync` — **medium**
Назначения в статусе `Draft` передаются новому эксперту вместе с черновиком прежнего: `Scores`, `Comment` и `Total` не сбрасываются. Новый эксперт видит оценки коллеги, что нарушает слепую экспертизу.
Как исправить: очищать черновик и выставлять `Status = Assigned`.

## 9. `Services/RankingCsvWriter.cs` — `Write` / `Escape` — **medium**
`Title` и `ApplicantName` вводит заявитель, а CSV открывают в Google Sheets. Значения, начинающиеся с `=`, `+`, `-`, `@`, `\t`, `\r`, не обезвреживаются, поэтому возможна formula injection у членов совета.
Как исправить: добавлять перед такими значениями `'`.

## 10. `ContestsController.CloseReview` / `ReviewService.SaveAsync` — **low**
Гонка закрытия экспертизы и отправки оценки. Если `SaveAsync` проверил `AcceptsReviews` до коммита закрытия, а сохраняет после, то `Submitted` перезаписывает `Expired`. Токена конкуренции у `Review` нет, поэтому и двойной submit проходит.
Как исправить: добавить `xmin` как concurrency token или делать условный `UPDATE ... WHERE Status IN (Assigned, Draft)`.

## 11. `Services/AssignmentService.cs` — `AssignAsync` — **low**
- Не проверяется, что конкурс существует и экспертиза не закрыта: после закрытия можно создать назначения, которые никто не сможет оценить.
- При параллельных одинаковых назначениях уникальный индекс `(ApplicationId, ExpertId)` даёт необработанный `DbUpdateException`, то есть 500 вместо 409.