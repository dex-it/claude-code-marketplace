| id | Название | Факт версии |
| --- | --- | --- |
| lazy-n1 | Ленивая загрузка навигации в цикле |  |
| readonly-tracking | Трекинг выборки только для чтения |  |
| tolist-projection | Полная сущность там, где нужна часть полей |  |
| filter-in-memory | Фильтр после материализации |  |
| aggregate-in-memory | Группировка и агрегаты после материализации |  |
| untranslatable-filter | Нетранслируемое условие фильтра |  |
| repo-materializes | Репозиторий материализует выборку |  |
| null-forgiving-aggregate | `!` на nullable-значении без фильтра по null |  |
| single-not-unique | `Single` на условии, которое в домене не уникально |  |
| null-guard-spec | Null-guard в спецификации на ненулевом параметре |  |
| fromsql-alias | Динамически собираемый `FromSqlRaw` |  |
| add-async | `Add` и `AddAsync` |  |
| owned-single-field | Owned-тип из одного поля |  |
| datetime-column | `DateTime` и тип колонки в Npgsql | с Npgsql 6 свойство без явного типа - `timestamptz` |
| softdelete-cascade | Soft-delete (`HasQueryFilter`) и каскад FK |  |
| required-orphans | Разрыв required-связи (`Clear()` коллекции зависимых) | при `Restrict` и `ClientSetNull` разрыв required-связи в `SaveChanges` бросает `InvalidOperationException` |
| concurrency-token | Параллельная правка одной записи |  |
| pessimistic-lock | `FOR UPDATE` и граница транзакции |  |
| savechanges-loop | `SaveChanges` в цикле по строкам |  |
| bulk-delete | Массовое удаление одной транзакцией |  |
| updaterange-tracked | `UpdateRange` на отслеживаемых сущностях |  |
| cartesian | Несколько коллекций в одном `Include`-запросе |  |
| split-single | Split query на выборке одной сущности |  |
| prod-migration | Применение миграции на production |  |
| data-and-schema | Данные и схема в одной миграции |  |
| schema-without-data | Схемная миграция и исторические данные |  |
| dbcontext-singleton | Время жизни `DbContext` |  |
| dbcontext-background | `DbContext` в `BackgroundService` |  |
