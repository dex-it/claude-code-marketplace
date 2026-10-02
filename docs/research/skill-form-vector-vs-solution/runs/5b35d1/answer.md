## Итоги ревью

Нашёл 11 находок, 4 из них критические — рекомендую не мерджить до исправления минимум critical/high.

**Critical:**
1. `VehicleService.ReplaceEquipmentAsync`/`FindVehicleAsync` — комплектация не удаляется (нет `.Include(v => v.Equipment)`), старые записи остаются в БД, возможен сбой на уникальном индексе.
2. `TripService.cs: TripRows.ToRows()` — `WorkCalendar.IsWorkingDay` не транслируется EF Core в SQL, ломает и новый `OffDayTripsAsync`, и уже существующий `GetVehicleTripsAsync` (регрессия).
3. `VehicleService.GetLastInspectionAsync` — сортировка по `CreatedAt` вместо `InspectedAt`; из-за офлайн-синхронизации планшетов «последним» может оказаться более старый безопасный осмотр, из-за чего машина с реальным блокирующим замечанием пройдёт проверку FLEET-107.
4. `TripService.GetOpenWaybillsAsync` — висящая `;` в `FromSqlRaw` ломает запрос, когда к нему добавляется `.Where(vehicleId)` (т.е. именно фильтр из FLEET-112, который не был протестирован, судя по MR).

**High:**
5. `StartTripAsync` — проверка допуска `ValidUntil > today` вместо `>=` (нарушает «включительно» из описания).
6. `Program.cs` — `PUT /vehicles/{id}/equipment` без ролевой политики, доступен любому авторизованному пользователю.
7. Миграция сужает `model` с 200 до 40 символов без обработки существующих более длинных значений — риск падения на prod.

**Medium:** нет проверки на уже открытую поездку при выпуске на линию; `GetOpenWaybillsAsync` отдаёт `Trip` без `Vehicle`/`Driver`.

**Low:** тихое отбрасывание дублей кодов оснащения; нет валидации `Qty >= 0`.

Полный разбор с обоснованием по каждому пункту — в `/home/mmx/.cache/research/runs/5b35d1/work/_answer.md`.