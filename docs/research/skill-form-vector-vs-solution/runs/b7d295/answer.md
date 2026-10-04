Провёл ревью MR !238. Результат записан в `/home/mmx/.cache/research/runs/b7d295/work/_answer.md`. Основные находки:

**Критичные:**
1. **`VehicleService.ReplaceEquipmentAsync`/`FindVehicleAsync`** — машина грузится без `.Include(v => v.Equipment)`, поэтому `vehicle.Equipment.Clear()` работает по пустой коллекции, а старые записи `vehicle_equipment` никогда не удаляются из БД. Замена комплектации (FLEET-104) фактически не работает — либо копятся дубли, либо `SaveChanges` падает на уникальном индексе `(vehicle_id, code)`. Соседний (неизменённый) `DriverService.ReplacePermitsAsync` делает это правильно через `Include`.
2. **`TripRows.ToRows()`** — новое поле `OffDay = !WorkCalendar.IsWorkingDay(t.StartedAt)` нетранслируемо в SQL (зависит от колонки, вычисляется клиентским методом) — ломает не только новый `OffDayTripsAsync` (FLEET-109), но и ранее рабочий `GetVehicleTripsAsync`.
3. **Миграция `VehicleEquipmentAndModelLength`** — сужение `vehicles.model` 200→40 без обработки существующих данных; по описанию задачи в проде уже есть значения длиннее 40 символов — `ALTER COLUMN` упадёт на prod с `value too long`.

**Высокие:**
4. `GetOpenWaybillsAsync` — `FromSqlRaw` с завершающей `;` ломает SQL при композиции `Where(vehicleId)` (фильтр по машине из FLEET-112 не протестирован и не работает).
5. `StartTripAsync` — проверка допуска `ValidUntil > today` вместо `>=`, нарушает явное "включительно" из описания задачи.
6. `GetLastInspectionAsync` — "последний" осмотр выбирается по `CreatedAt`, который совпадает у осмотров одного синк-батча (`now()` стабильна в транзакции) — риск выбрать не тот осмотр и пропустить блокирующее замечание.

**Средние:** отсутствует ограничение по роли на `PUT /vehicles/{id}/equipment`; нет проверки на уже открытый путевой лист при выпуске машины.

**Низкие:** отсутствие `AsNoTracking()` для read-only выборок Vehicle/Driver в `StartTripAsync`; нет валидации `year`/`month` в `OffDayTripsAsync`.