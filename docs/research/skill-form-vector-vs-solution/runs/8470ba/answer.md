Провёл ревью MR !238. Основные находки (полный текст с номерами строк — в `/home/mmx/.cache/research/runs/8470ba/work/_answer.md`):

**Critical**
1. `TripService.cs::OffDayTripsAsync`/`TripRows.ToRows` — `Where`/`OrderBy` после проекции с нетранслируемым `WorkCalendar.IsWorkingDay(...)`; упадёт с `InvalidOperationException` на каждом вызове.
2. `TripService.cs::GetOpenWaybillsAsync` — raw SQL с завершающей `;` ломается при композиции `.Where(vehicleId)`, то есть именно на требуемом тикетом пути с фильтром по машине.
3. `VehicleService.cs::GetLastInspectionAsync` — сортировка «последнего» осмотра по `CreatedAt` вместо `InspectedAt`; при batch-синке offline-осмотров `CreatedAt` совпадает (постгресовый `now()` = время транзакции), можно пропустить реальный блокирующий дефект.
4. `Migrations/..._VehicleEquipmentAndModelLength.cs` — сужение `model` до 40 без переноса/обрезки существующих данных; по смыслу тикета в проде уже есть более длинные значения — миграция упадёт на деплое.

**High**
5. `TripService.cs::StartTripAsync` — `p.ValidUntil > today` вместо `>=`: допуск неправомерно считается истёкшим в последний (включительный) день действия.
6. `VehicleService.cs::ReplaceEquipmentAsync` — `Clear()+Add()` в одном `SaveChanges` при уникальном индексе `(vehicle_id, code)`: типичный конфликт `23505` при пересылке комплектации с совпадающими кодами.
7. `Program.cs` — `PUT /api/vehicles/{id}/equipment` без политики авторизации (в отличие от соседних мутаций), любой аутентифицированный пользователь может переписать комплектацию безопасности.

**Medium**
8. `TripService.cs::StartTripAsync` — нет проверки на уже открытый путевой лист у машины/водителя (двойной выпуск на линию).

**Low**
9. `TripService.cs::StartTripAsync` — машина и водитель читаются как tracked-сущности, хотя не модифицируются (нужен `AsNoTracking()`).