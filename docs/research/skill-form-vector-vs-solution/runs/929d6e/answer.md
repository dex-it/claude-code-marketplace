Провёл ревью MR !238. Нашёл 8 дефектов (ответ также сохранён в `_answer.md`):

**Critical**

1. **`TripService.cs` — `TripRows.ToRows()`**: `OffDay = !WorkCalendar.IsWorkingDay(t.StartedAt)` вызывается внутри LINQ-to-Entities `Select`, а `IsWorkingDay` использует `TimeZoneInfo`/`HashSet` — EF Core не сможет транслировать это в SQL, запрос упадёт с рантайм-исключением. Ломает не только новый `OffDayTripsAsync` (FLEET-109), но и ранее рабочий `GetVehicleTripsAsync` — регрессия.

2. **`VehicleService.cs` — `ReplaceEquipmentAsync`**: `FindVehicleAsync` не делает `.Include(v => v.Equipment)`, поэтому `vehicle.Equipment.Clear()` — no-op над пустой коллекцией, старые записи в БД не удаляются, а вставка новых падает на уникальном индексе `(vehicle_id, code)`. Эталонный аналог в MR — `DriverService.ReplacePermitsAsync` — делает `Include` правильно.

**High**

3. **`VehicleService.cs` — `GetLastInspectionAsync`**: сортировка по `CreatedAt` (время приёма сервером) вместо `InspectedAt` (время реального осмотра). Из-за офлайн-синхронизации с планшетов более ранний "чистый" осмотр может перекрыть более поздний с блокирующим замечанием — машина может выехать с незамеченным блокирующим дефектом.

4. **`TripService.cs` — `GetOpenWaybillsAsync`**: сырой SQL заканчивается `;`; при фильтре по `vehicleId` EF оборачивает его в подзапрос, и точка с запятой ломает SQL. Именно фильтр по машине (FLEET-112) не протестирован в MR.

5. **`TripService.cs` — `StartTripAsync`**: сравнение `p.ValidUntil > today` вместо `>=` — допуск должен действовать "включительно" по указанную дату, сейчас отказ на день раньше.

6. **`Program.cs` — `PUT /api/vehicles/{id}/equipment`**: единственный изменяющий эндпоинт без ролевой политики `RequireAuthorization`, доступен любому аутентифицированному пользователю.

**Medium**

7. **Миграция `VehicleEquipmentAndModelLength`**: сужение `model` до `varchar(40)` без проверки/усечения существующих данных — риск падения на проде, учитывая, что в MR упоминаются уже существующие длинные названия моделей.

**Low**

8. Индекс `Inspection(VehicleId, CreatedAt)` соответствует ошибочной сортировке из находки №3 — после исправления стоит пересмотреть на `InspectedAt`.