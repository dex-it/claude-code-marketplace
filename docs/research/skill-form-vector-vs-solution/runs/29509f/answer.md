## Результат ревью MR !238

**Критические дефекты (блокируют мердж):**

1. **`VehicleService.ReplaceEquipmentAsync`** — `FindVehicleAsync` не делает `Include(v => v.Equipment)`, поэтому `vehicle.Equipment.Clear()` чистит пустую (незагруженную) коллекцию. Старая комплектация в БД не удаляется, а повторная вставка того же `Code` упадёт на unique-индексе `(vehicle_id, code)`. Аналогичный метод `DriverService.ReplacePermitsAsync` для контраста делает `Include` правильно.

2. **`VehicleService.GetLastInspectionAsync`** — «последний осмотр» для выпуска на линию определяется сортировкой по `CreatedAt` (время приёма сервером), а не по `InspectedAt` (время факт. осмотра). При офлайн-синхронизации пачками это может подсунуть более старый, но позже синхронизированный осмотр вместо реально последнего — подрывает требование FLEET-107 про блокирующие замечания.

3. **`TripService.OffDayTripsAsync`** — после `.ToRows()` (Select с нетранслируемым `WorkCalendar.IsWorkingDay`) идут ещё `Where`/`OrderByDescending`, то есть Select не финальный — EF не сможет это транслировать, запрос упадёт в рантайме. В MR.md тестирование этого отчёта (FLEET-109) не упомянуто.

**High:**

4. **`TripService.StartTripAsync`** — `p.ValidUntil > today` вместо `>=`; допуск, действующий «по дату включительно», ровно в последний день будет считаться недействующим.

5. **`TripService.GetOpenWaybillsAsync`** — `FromSqlRaw` оканчивается на `;`; при фильтре по `vehicleId` EF оборачивает это в подзапрос — синтаксическая ошибка Postgres. Путь без фильтра (протестированный в MR) не задевает эту проблему.

6. **`Program.cs`** — `PUT /api/vehicles/{id}/equipment` не имеет `.RequireAuthorization("Mechanic")`, в отличие от всех остальных мутирующих эндпоинтов — любой аутентифицированный пользователь может подменить комплектацию машины.

7. **Миграция `VehicleEquipmentAndModelLength`** — сужение `vehicles.model` с 200 до 40 без обработки существующих данных; на prod с реальными длинными названиями моделей `ALTER COLUMN` упадёт.

**Low:**

8. **`VehicleService.FindByPlateAsync`** — читающий запрос без `AsNoTracking()`.

Полный текст с деталями и обоснованием записан в `/home/mmx/.cache/research/runs/29509f/work/_answer.md`.