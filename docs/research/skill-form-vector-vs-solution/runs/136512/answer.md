Провёл ревью MR !238. Основные находки (полный текст также записан в `_answer.md`):

**Critical**
1. **`TripService.GetOpenWaybillsAsync`** — `FromSqlRaw` заканчивается `;`; при композиции `.Where(t => t.VehicleId == id)` EF оборачивает сырой SQL в подзапрос, и `;` внутри скобок даёт синтаксическую ошибку Postgres. Ломается ровно фильтр по машине — ключевое требование FLEET-112, а в MR протестирован только путь без фильтра.
2. **`VehicleService.ReplaceEquipmentAsync`** — `FindVehicleAsync` не делает `.Include(v => v.Equipment)`, поэтому `vehicle.Equipment.Clear()` чистит пустую коллекцию; старое оснащение в БД не удаляется, «замена целиком» не работает (возможен ещё и конфликт unique-индекса). Рядом в `DriverService.ReplacePermitsAsync` этот же паттерн сделан правильно — явная асимметрия.
3. **`TripRows.ToRows()`** — новое поле `OffDay` вызывает `WorkCalendar.IsWorkingDay` (конвертация часового пояса + `HashSet`) внутри `IQueryable.Select`; это нетранслируемо в SQL и упадёт не только в новом `OffDayTripsAsync`, но и в уже существующем `GetVehicleTripsAsync`, который переиспользует `ToRows()`.
4. **Миграция `VehicleEquipmentAndModelLength`** — `ALTER COLUMN model TYPE varchar(40)` без обработки исторических данных; сам MR подтверждает, что в проде уже есть более длинные значения («принтер обрезал на середине») — миграция упадёт на проде с «value too long».

**High**
5. **`TripService.StartTripAsync`** — проверка допуска `p.ValidUntil > today` вместо `>=`, хотя по описанию допуск действует «по дату включительно» — в последний день допуска диспетчеру ошибочно откажут.
6. **`VehicleService.GetLastInspectionAsync`** — «последний» осмотр выбирается по `CreatedAt` (время приёма), а не по `InspectedAt` (время осмотра), хотя осмотры приходят пачками офлайн — для safety-проверки в FLEET-107 это может выбрать не фактически свежайший осмотр.
7. **`Program.cs` — `PUT /vehicles/{id}/equipment`** — единственный мутирующий эндпоинт без ролевой политики (`RequireAuthorization("Mechanic")` и т.п.); любой аутентифицированный пользователь может переписать оснащение машины.

**Low**
8. `DistinctBy` в `ReplaceEquipmentAsync`/`ReplacePermitsAsync` молча отбрасывает дубликаты вход­ных данных без сигнала об этом.