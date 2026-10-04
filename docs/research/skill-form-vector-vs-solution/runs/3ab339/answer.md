Провёл ревью изменений MR !238. Основные находки (полный текст также записан в `work/_answer.md`):

**Critical**
1. `VehicleService.cs → ReplaceEquipmentAsync` — `FindVehicleAsync` грузит `Vehicle` без `Include(v => v.Equipment)`, поэтому `Clear()` чистит пустую in-memory коллекцию, а не реальные строки из БД. Старое оснащение не удаляется (нарушение требования FLEET-104 «заменяем целиком»), а повторная отправка тех же кодов упадёт по уникальному индексу `(vehicle_id, code)`. Эталонный паттерн рядом — `DriverService.ReplacePermitsAsync` с `Include`.
2. `TripService.cs → TripRows.ToRows()` (используется в `GetVehicleTripsAsync` и `OffDayTripsAsync`) — `OffDay = !WorkCalendar.IsWorkingDay(t.StartedAt)` вызывается внутри LINQ-проекции над `IQueryable<Trip>`; EF Core не может транслировать `TimeZoneInfo`/`HashSet.Contains` в SQL — оба эндпоинта упадут с `InvalidOperationException` при материализации. Отчёт FLEET-109, похоже, просто не был протестирован вручную.
3. `VehicleService.cs → GetLastInspectionAsync` — «последний» осмотр выбирается по `CreatedAt` (время получения сервером), а не по `InspectedAt` (реальное время осмотра). Планшеты синхронизируются офлайн с задержкой, порядок может не совпадать — машину можно выпустить, пропустив более поздний осмотр с блокирующим замечанием. Safety-критично для FLEET-107.

**High**
4. `TripService.cs → StartTripAsync` — проверка допуска `p.ValidUntil > today` вместо `>=`; допуск действует «по дату включительно», сейчас в последний день допуска трипы ошибочно запрещаются.
5. `TripService.cs → GetOpenWaybillsAsync` — raw SQL с `;` и `ORDER BY` внутри; при фильтре по `vehicleId` EF оборачивает его в подзапрос, и `;` внутри скобок даёт синтаксическую ошибку Postgres — ровно тот сценарий (фильтр по машине, FLEET-112), который не упомянут как протестированный в MR.

**Medium**
6. `Program.cs` — у `PUT /api/vehicles/{id}/equipment` нет `RequireAuthorization`, в отличие от соседних мутирующих эндпоинтов — любой аутентифицированный пользователь может подменить комплектацию машины.
7. Миграция `VehicleEquipmentAndModelLength` сокращает `model` до `varchar(40)`; если в prod есть записи длиннее 40 символов, `ALTER COLUMN TYPE` упадёт при деплое — проверка данных prod в MR не упомянута.

**Low**
8. `TripService.cs → StartTripAsync` — `vehicle` и `driver` грузятся трекаемыми запросами, хотя не изменяются; стоит `AsNoTracking()`.