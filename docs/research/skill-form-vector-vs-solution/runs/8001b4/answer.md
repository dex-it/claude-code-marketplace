## Итоги ревью MR !238

Нашёл 8 дефектов (полный текст также записан в `work/_answer.md`):

1. **TripService.cs — `TripRows.ToRows()`** (critical) — `WorkCalendar.IsWorkingDay()` вызывается внутри `IQueryable`-проекции, не транслируется в SQL → падение в рантайме для `GetVehicleTripsAsync` и `OffDayTripsAsync` (ломает и новый отчёт, и уже работавший список поездок).
2. **VehicleService.cs — `ReplaceEquipmentAsync`** (critical) — машина загружается без `Include(Equipment)`, `Clear()` — no-op, старое оборудование не удаляется, возможно нарушение уникального индекса. Замена комплектации по факту не работает.
3. **TripService.cs — `GetOpenWaybillsAsync`** (high) — `FromSqlRaw` с завершающей `;`, композиция с `.Where(VehicleId == id)` даёт невалидный SQL → фильтр по машине (FLEET-112) падает.
4. **VehicleService.cs — `GetLastInspectionAsync`** (high) — "последний осмотр" выбирается по `CreatedAt` (время синхронизации), а не по `InspectedAt` (время осмотра); при офлайн-батчах это может выбрать не тот осмотр для решения о выпуске на линию.
5. **TripService.cs — `StartTripAsync`** (medium) — проверка допуска `ValidUntil > today` вместо `>= today`, допуск ошибочно считается истёкшим в последний разрешённый день.
6. **Migrations/…VehicleEquipmentAndModelLength.cs** (high) — сужение `vehicles.model` 200→40 без переноса/усечения существующих данных; велика вероятность падения миграции на prod, так как длинные названия там, судя по описанию задачи, уже есть.
7. **Program.cs — `PUT /vehicles/{id}/equipment`** (medium) — отсутствует `RequireAuthorization("Mechanic")`, в отличие от аналогичных мутирующих эндпоинтов.
8. **VehicleService.cs — `GetLastInspectionAsync` + глобальный `SplitQuery`** (low) — лишний round-trip для запроса с одной коллекцией на горячем пути выпуска на линию.