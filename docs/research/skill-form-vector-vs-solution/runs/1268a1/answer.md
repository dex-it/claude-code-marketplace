## Ревью MR !238

**1. `VehicleService.cs` — `ReplaceEquipmentAsync` — critical.** `FindVehicleAsync` не делает `.Include(v => v.Equipment)`, поэтому `vehicle.Equipment.Clear()` чистит пустой список из инициализатора, а не загруженные из БД строки. Старое оснащение в БД не удаляется; повторная синхронизация с теми же кодами упадёт на уникальном индексе `(vehicle_id, code)`. Сравните с `DriverService.ReplacePermitsAsync`, где `.Include(d => d.Permits)` сделан правильно.

**2. `Migrations/...VehicleEquipmentAndModelLength.cs` — `Up()` — critical.** Сужение `vehicles.model` с `varchar(200)` до `varchar(40)` без переноса/обрезки существующих данных. В MR прямо сказано, что длинные названия моделей уже есть в системе — `ALTER COLUMN` на prod упадёт с `value too long for type character varying(40)`.

**3. `TripService.cs` — `OffDayTripsAsync`/`TripRows.ToRows` — critical.** `WorkCalendar.IsWorkingDay` не транслируется в SQL; в `OffDayTripsAsync` поверх `Select` навешаны `Where`/`OrderByDescending`, из-за чего Select перестаёт быть финальной проекцией — EF бросит `InvalidOperationException` при каждом вызове отчёта FLEET-109. (В `GetVehicleTripsAsync`, где Select финальный, это работает.)

**4. `TripService.cs` — `StartTripAsync` — high.** Проверка допуска `p.ValidUntil > today` вместо `>=` — противоречит требованию «действует по дату включительно», водителю незаконно откажут в последний день допуска.

**5. `VehicleService.cs` — `GetLastInspectionAsync` — high.** Сортировка по `CreatedAt` вместо `InspectedAt` — при офлайн-синхронизации пачками (сценарий явно описан в комментариях) «последним» может быть выбран не самый свежий по факту осмотр, что ломает проверку FLEET-107.

**6. `Program.cs` — `PUT /api/vehicles/{id}/equipment` — high.** В отличие от всех остальных мутирующих эндпоинтов, нет `.RequireAuthorization("...")` с конкретной ролью — любой аутентифицированный пользователь может перезаписать комплектацию машины.

**7. `TripService.cs` — `GetOpenWaybillsAsync` — medium.** `Where` поверх `FromSqlRaw` с `ORDER BY` оборачивает запрос в подзапрос без внешней сортировки — порядок результата по конкретной машине не гарантирован.

**8. `VehicleService.cs` — `ReplaceEquipmentAsync` (`DistinctBy`) — low.** Дубликаты кодов во входных данных молча отбрасываются без сигнала об ошибке ввода.

Полный текст с деталями и обоснованием сохранён в `/home/mmx/.cache/research/runs/1268a1/work/_answer.md`.