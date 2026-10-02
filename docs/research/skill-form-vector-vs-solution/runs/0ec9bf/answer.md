## Итоги ревью MR !238

**Critical**
1. `VehicleService.cs: ReplaceEquipmentAsync` — `FindVehicleAsync` не делает `Include(v => v.Equipment)`, `Clear()` работает на пустой коллекции, старые строки оснащения не удаляются, новые добавляются поверх → либо дублирование, либо нарушение unique-индекса. Сравните с эталонным `DriverService.ReplacePermitsAsync`, где `Include` сделан.
2. `VehicleService.cs: GetLastInspectionAsync` — сортировка по `CreatedAt` вместо `InspectedAt`; при офлайн-синхронизации планшетов «последним» может оказаться не самый свежий по факту осмотр, что ломает безопасность допуска на линию (FLEET-107).
3. `TripService.cs: GetOpenWaybillsAsync` — `FromSqlRaw` с завершающим `;`; при фильтре по `vehicleId` EF оборачивает SQL в подзапрос → синтаксическая ошибка Postgres. Именно фильтрованный путь (ключевое требование FLEET-112) не был протестирован.
4. `TripService.cs: TripRows.ToRows / OffDayTripsAsync` (задевает и `GetVehicleTripsAsync`) — `WorkCalendar.IsWorkingDay` нетранслируем в SQL, а используется как условие фильтра/сортировки в `IQueryable` до материализации → `InvalidOperationException` при каждом вызове отчёта FLEET-109.

**High**
5. `TripService.cs: StartTripAsync` — сравнение `ValidUntil > today` вместо `>= today` противоречит описанию «допуск действует включительно по дату».
6. `Program.cs` — `PUT /api/vehicles/{id}/equipment` не имеет ролевой политики (в отличие от аналогичного `/inspections/sync` → `Mechanic`), любой аутентифицированный пользователь может подменить комплектацию машины.

**Medium**
7. Миграция `VehicleEquipmentAndModelLength` — сужение `vehicles.model` 200→40 без проверки существующих данных; на prod-данных длиннее 40 символов миграция упадёт и заблокирует деплой.

**Low**
8. `TripService.cs: StartTripAsync` — читающие запросы `Vehicles`/`Drivers` без `AsNoTracking()`.

Полный текст с деталями записан в `/home/mmx/.cache/research/runs/0ec9bf/work/_answer.md`.