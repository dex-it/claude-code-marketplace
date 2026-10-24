## Ревью MR !238

### Critical

**1. `VehicleService.cs` — `ReplaceEquipmentAsync`.** `FindVehicleAsync` грузит `Vehicle` без `.Include(v => v.Equipment)`, поэтому `Clear()` работает над пустым несвязанным списком — старые строки `vehicle_equipment` в БД не удаляются, а повторная отправка того же набора кодов упадёт по уникальному индексу `(vehicle_id, code)`. Соседний `DriverService.ReplacePermitsAsync` делает это правильно (`.Include(d => d.Permits)`) — здесь паттерн нарушен.

**2. `TripService.cs` — `OffDayTripsAsync` / `TripRows.ToRows()`.** `OffDay` вычисляется через непереводимый в SQL метод `WorkCalendar.IsWorkingDay`. В `GetVehicleTripsAsync` проекция терминальна и это ещё работает, но в `OffDayTripsAsync` после неё идут `.Where(r => r.OffDay)` и `.OrderByDescending`, что ломает трансляцию LINQ→SQL — отчёт FLEET-109 будет падать с исключением при каждом вызове. В MR.md этот сценарий не упомянут в разделе тестирования.

**3. `VehicleService.cs` — `GetLastInspectionAsync`.** Сортировка по `CreatedAt` (время приёма сервером), а не по `InspectedAt` (реальное время осмотра), при офлайн-батчевой синхронизации планшетов может подставить как "последний" более старый, но позже засинхронизированный осмотр без блокирующих замечаний — и скрыть более свежий осмотр с блокировкой. Подрывает ключевую safety-проверку FLEET-107.

### High

**4. `TripService.cs` — `StartTripAsync`.** `p.ValidUntil > today` вместо `>=` — допуск должен действовать "по указанную дату включительно" (п. FLEET-107), сейчас в последний валидный день выпуск ошибочно блокируется.

**5. `TripService.cs` — `GetOpenWaybillsAsync`.** `FromSqlRaw` заканчивается `;`; при фильтре по `vehicleId` EF оборачивает raw SQL в подзапрос, и `;` внутри скобок даёт синтаксическую ошибку SQL — фильтрация по машине (явное требование FLEET-112) не работает. Без фильтра баг не проявляется, что и объясняет, почему в MR протестирован только вариант "по всему парку".

**6. `Migrations/...VehicleEquipmentAndModelLength.cs`.** Сужение `model` 200→40 без обработки существующих данных — если в проде уже есть значения длиннее 40 символов (а MR прямо на это намекает), `ALTER COLUMN` упадёт на проде с "value too long".

### Medium

**7. `Program.cs` — `PUT /api/vehicles/{id}/equipment`.** В отличие от всех остальных мутирующих эндпоинтов, нет `.RequireAuthorization(...)` — любой аутентифицированный пользователь может переписать комплектацию безопасности машины вместо только механика.

Полный текст с деталями записан в `/home/mmx/.cache/research/runs/fb0108/work/_answer.md`.