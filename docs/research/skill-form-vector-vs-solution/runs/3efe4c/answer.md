Провёл ревью MR !238. Основные находки (полный текст также записан в `_answer.md`):

**Critical**
1. `TripService.cs: TripRows.ToRows()` — `WorkCalendar.IsWorkingDay(t.StartedAt)` вызывается внутри LINQ-проекции над `IQueryable<Trip>`; EF Core не умеет транслировать произвольный статический метод в SQL → runtime `InvalidOperationException`. Ломает не только новый отчёт `OffDayTripsAsync` (FLEET-109), но и регрессирует уже рабочий `GetVehicleTripsAsync`, т.к. оба используют общий `ToRows()`.
2. `VehicleService.cs: ReplaceEquipmentAsync` — забыли `.Include(v => v.Equipment)` (в отличие от корректного аналога `DriverService.ReplacePermitsAsync`). `Clear()` чистит пустую несвязанную коллекцию, старые строки `vehicle_equipment` в БД не удаляются → при повторной присылке комплектации конфликт по уникальному индексу `(vehicle_id, code)`, либо "осиротевшие" записи остаются навсегда. Семантика "замена целиком" (FLEET-104) не работает.

**High**
3. `TripService.cs: StartTripAsync` — проверка допуска `p.ValidUntil > today` вместо `>=`; по условию допуск действует "по дату включительно" — в последний день допуска диспетчер не сможет выпустить машину.
4. `VehicleService.cs: GetLastInspectionAsync` — сортировка по `CreatedAt`, а не по `InspectedAt`; при батч-синхронизации офлайн-осмотров все записи пачки получают одинаковый `now()` (PostgreSQL `now()` = время начала транзакции), порядок внутри пачки не определён → возможен выбор не самого свежего осмотра для решения о выпуске на линию (безопасность, FLEET-107).
5. `TripService.cs: GetOpenWaybillsAsync` — сырой SQL в `FromSqlRaw` заканчивается на `ORDER BY ...;`; при фильтре по `vehicleId` EF оборачивает его в подзапрос, и точка с запятой внутри скобок даёт синтаксическую ошибку Postgres — ломается именно та фильтрация, которую явно требует FLEET-112.
6. `Migrations/..._VehicleEquipmentAndModelLength.cs: Up` — сужение `vehicles.model` до `varchar(40)` без обрезки/проверки существующих данных; сама мотивация задачи ("модели обрезались при печати") намекает, что в проде уже могут быть значения длиннее 40 символов — миграция упадёт при применении.

**Medium**
7. `GetOpenWaybillsAsync` использует SQL `now()` против "наивной" `timestamp`-колонки вместо UTC-границ, как в остальных методах файла — зависит от сессионного `TimeZone` на стороне Postgres.
8. `StartTripAsync` не проверяет, что машина/водитель уже не задействованы в незакрытом рейсе — возможен "двойной выпуск".
9. `Program.cs`: `PUT /api/vehicles/{id}/equipment` не имеет конкретной `RequireAuthorization` политики (в отличие от всех соседних мутирующих эндпоинтов) — доступен любой аутентифицированной роли.

**Low**
10. `EquipmentDto.Qty` не валидируется (может быть 0/отрицательным).