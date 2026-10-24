Ревью готово, результат сохранён в `/home/mmx/.cache/research/runs/f2da3f/work/_answer.md`. Основные находки:

**Critical (блокеры):**
1. `VehicleService.cs: ReplaceEquipmentAsync` — `FindVehicleAsync` не делает `.Include(v => v.Equipment)`, поэтому `Clear()` работает на пустой коллекции, старая комплектация в БД не удаляется (сравните с правильным паттерном в неизменённом `DriverService.ReplacePermitsAsync`).
2. `TripService.cs: OffDayTripsAsync` / `TripRows.ToRows` — `Where(r => r.OffDay)` после проекции с непереводимым вызовом `WorkCalendar.IsWorkingDay` → EF Core бросит исключение трансляции запроса, отчёт FLEET-109 не работает.
3. `TripService.cs: GetOpenWaybillsAsync` — raw SQL заканчивается `;`, при композиции с `.Where(vehicleId)` получается синтаксически невалидный подзапрос — фильтр по машине (FLEET-112) ломает запрос.

**High:**
4. `TripService.cs: StartTripAsync` — `ValidUntil > today` вместо `>= today` (off-by-one, допуск должен действовать включительно по указанную дату).
5. Миграция `VehicleEquipmentAndModelLength` — сужение `model` до varchar(40) без обрезки существующих данных, упадёт на prod при наличии более длинных значений.
6. `VehicleService.cs: GetLastInspectionAsync` — сортировка по `CreatedAt` вместо `InspectedAt`; при пакетной офлайн-синхронизации порядок ненадёжен (все записи батча получают одинаковый `now()`), а это влияет на safety-проверку при выпуске на линию.

**Medium:**
7. `Program.cs` — эндпоинт `PUT /vehicles/{id}/equipment` не имеет ролевой `RequireAuthorization`, в отличие от остальных мутирующих эндпоинтов.
8. `TripService.cs: StartTripAsync` — нет проверки на уже открытый рейс у машины перед выпуском нового.