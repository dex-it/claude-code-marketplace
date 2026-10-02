## Изменённые/созданные файлы
- `Models.cs` — поля `Phone` и `CompletionComment` у `ServiceRequest`.
- `HousingDbContext.cs` — длина `Phone`, уникальный индекс `MaintenancePlan.HouseId`.
- `HousingService.cs` — сортировка реестра (`sort`/`dir` через whitelist колонок), телефон в заявке, `CloseRequestAsync` + `RequestConflictException` для закрытия.
- `PlanService.cs` — `ReplacePlanAsync` для замены плана целиком с сохранением истории совпавших работ.
- `Endpoints.cs` (новый) — маршруты `GET/POST /requests`, `POST /requests/{id}/close`, `PUT /houses/{id}/plan`.

## Решения
Сортировка строится по белому списку SQL-колонок, а не по значению из запроса, джойны переиспользуются для фильтров и сортировки по адресу. Замена плана использует новый уникальный индекс по `HouseId`, чтобы `SingleOrDefaultAsync` был оправдан гарантией БД; удаление выбывших работ отдано явному `Remove`/каскаду, так как `DeleteOrphansTiming = Never`. 409 при закрытии заявки реализован через отдельное исключение, перехватываемое эндпоинтом.

Миграцию EF Core (новые колонки и индекс) я не генерировал — это требует `dotnet ef migrations add` и сборки, что запрещено условием; нужно сделать это отдельным шагом до релиза. Тот же текст записан в `_answer.md`.