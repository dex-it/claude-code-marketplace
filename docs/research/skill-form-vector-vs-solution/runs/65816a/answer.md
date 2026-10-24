Провёл ревью MR !238. Ниже — находки (файл/метод, причина, severity); тот же текст сохранён в `_answer.md`.

## Критичные

1. **`TripService.OffDayTripsAsync`** — после `ToRows()` (проекция в `TripRow`, где `OffDay` вычисляется вызовом `WorkCalendar.IsWorkingDay`, не транслируемым в SQL) идёт `Where(r => r.OffDay)`. Фильтрация по нетранслируемому полю после материализующей top-level проекции ломает трансляцию запроса — EF бросит `InvalidOperationException` при каждом вызове. Эндпоинт FLEET-109 нерабочий в принципе. **critical**

2. **`TripService.GetOpenWaybillsAsync`** — raw SQL в `FromSqlRaw` оканчивается `;` перед закрывающей тройной кавычкой. Когда передан `vehicleId`, EF оборачивает этот SQL в подзапрос и добавляет `WHERE` снаружи — `;` внутри скобок даёт синтаксическую ошибку Postgres. Именно "фильтр по машине" (цель FLEET-112) и не тестировался по заметке в MR ("список... по всему парку"). **critical**

3. **`VehicleService.ReplaceEquipmentAsync`** — `FindVehicleAsync` не делает `Include(v => v.Equipment)`, поэтому `vehicle.Equipment.Clear()` чистит пустую непрогруженную коллекцию, а не БД. Старое оснащение не удаляется; при повторной отправке тех же кодов упадёт unique-индекс `(vehicle_id, code)`. "Заменяем на присланную" из описания задачи не выполняется. **critical**

4. **`Migrations/.../VehicleEquipmentAndModelLength.Up`** — `AlterColumn` сужает `vehicles.model` с 200 до 40 без предварительного усечения данных. По описанию задачи такие длинные названия моделей в проде почти наверняка существуют (это и было причиной обрезки на печати) — миграция на bundle-выкате в production упадёт с ошибкой "value too long". Проверено только на dev-базе. **critical**

## Высокая

5. **`TripService.StartTripAsync`** — проверка допуска `p.ValidUntil > today` вместо `>= today`; по описанию допуск действует "по указанную дату включительно". В последний разрешённый день водителю незаконно откажут в выезде. **high**

6. **`VehicleService.GetLastInspectionAsync`** — "последний" осмотр определяется `OrderByDescending(i => i.CreatedAt)`, а не по `InspectedAt`. Планшеты синхронизируются офлайн пачками, поэтому порядок приёма не совпадает с порядком реальных осмотров — безопасность-критичная проверка в FLEET-107 может ориентироваться не на тот осмотр. **high**

7. **`Program.cs`**, `PUT /api/vehicles/{id}/equipment` — в отличие от всех остальных мутирующих эндпоинтов, нет `.RequireAuthorization("Mechanic"/"FleetManager")`, только групповая авторизация (любой аутентифицированный пользователь). Любая роль может переписать комплектацию безопасности машины. **high**

## Низкая/средняя

8. `ReplaceEquipmentAsync` — `DistinctBy(i => i.Code)` молча отбрасывает дубли кодов без сигнала о конфликте. **low**
9. `ReplaceEquipmentAsync` — нет защиты от параллельной правки (read-modify-write без concurrency-контроля). **low**
10. `VehicleEquipment.Qty` — нет ограничения домена (отрицательные/нулевые значения проходят). **low**