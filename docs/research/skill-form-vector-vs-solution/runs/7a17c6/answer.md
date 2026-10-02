## Ревью MR !238

**Critical**
1. **`VehicleService.ReplaceEquipmentAsync`** — `FindVehicleAsync` не делает `Include(Equipment)`, `Clear()` чистит пустую (не загруженную) коллекцию, старые строки комплектации не удаляются из БД; повторная отправка тех же кодов упадёт на уникальном индексе `(vehicle_id, code)`. Сравните с правильным аналогом `DriverService.ReplacePermitsAsync`, который грузит коллекцию перед `Clear()`.
2. **`TripService.GetOpenWaybillsAsync`** — raw SQL заканчивается `;`; при фильтре по `vehicleId` EF оборачивает его в подзапрос, и точка с запятой перед `)` даёт синтаксическую ошибку Postgres. Ломается именно фильтр по машине — ключевая часть FLEET-112, и именно он не упомянут в разделе «Проверено локально».
3. **`TripService.OffDayTripsAsync`** — `ToRows()` вызывает нетранслируемый `WorkCalendar.IsWorkingDay` не в финальной проекции (после Select идут ещё `Where`/`OrderByDescending`), EF Core бросит `InvalidOperationException`. Эндпоинт FLEET-109 всегда падает.

**High**
4. **`TripService.StartTripAsync`** — проверка допуска `p.ValidUntil > today` вместо `>=`; требование «включительно по дату» не соблюдается, в последний день допуска машину не выпустят.
5. **`VehicleService.GetLastInspectionAsync`** — сортировка по `CreatedAt` (время получения), а не `InspectedAt` (время осмотра); при офлайн-синхронизации с планшетов позже дошедший, но более ранний «чистый» осмотр может перекрыть реально более поздний осмотр с блокирующим дефектом — машина может быть неправомерно выпущена на линию.
6. **`Program.cs`** — `PUT /vehicles/{id}/equipment` не имеет `RequireAuthorization("Mechanic")` (или аналога), в отличие от всех прочих мутирующих эндпоинтов; менять комплектацию может любой аутентифицированный пользователь.
7. **Миграция `VehicleEquipmentAndModelLength`** — сужение `vehicles.model` с 200 до 40 без проверки/переноса существующих данных; при наличии более длинных значений в проде `ALTER COLUMN` упадёт.

**Medium**
8. **`TripService.StartTripAsync`** — нет проверки на уже открытый (незакрытый) путевой лист той же машины перед стартом нового — возможен двойной выпуск.

**Low**
9. **`VehicleService.FindByPlateAsync`** — читающий запрос без `AsNoTracking()`.
10. **`TripService.StartTripAsync`** — выборки `Vehicle`/`Driver` только для проверки условий, но без `AsNoTracking()`.

Полный текст с деталями и обоснованиями сохранён в `work/_answer.md`.