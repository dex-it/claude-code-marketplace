## Изменённые/созданные файлы

Изменённые:
- `src/VetClinic.Records/Domain.cs` — `Visit.Notes` → `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicCardService.cs` — добавлены `DeleteOwnerAsync`, `ReplaceAllergiesAsync`; `UpdateVisitNotesAsync` → `UpdateVisitAnamnesisAsync`; `AddAllergyAsync` удалён (заменён полной заменой списка); `VisitDto.Notes` → `Anamnesis`.
- `src/VetClinic.Records/Program.cs` — эндпоинты: `DELETE /owners/{id}`, `PUT /pets/{id}/allergies` (весь список), `PUT /visits/{id}/anamnesis` вместо `/notes`.

Новые:
- `src/VetClinic.Records/Migrations/20261002101500_RenameVisitNotesToAnamnesis.cs` + `.Designer.cs`
- `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs`

## Решения
- `DeleteOwnerAsync` явно каскадирует soft-delete Owner→Pets→Allergies/Visits через `ExecuteUpdateAsync` в одной транзакции, т.к. `HasQueryFilter` каждой таблицы смотрит только на собственный `IsDeleted`, а не на флаг родителя.
- `ReplaceAllergiesAsync` мягко удаляет старые аллергии (история сохраняется) и вставляет ровно присланный список в той же транзакции.
- Переименование `Notes→Anamnesis` сделано прямым `RenameColumn` без expand/contract, поскольку по CI миграция накатывается в окне обслуживания при остановленном приложении.

Важная оговорка: в репозитории не было папки `Migrations`, поэтому это первая миграция, написанная руками (`dotnet ef` недоступен) — файлы `.Designer.cs`/снапшот стоит сверить с реальным `dotnet ef migrations add` на машине с тулингом перед мёрджем. Полный текст ответа также записан в `_answer.md`.