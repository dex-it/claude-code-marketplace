## Изменённые файлы
- `src/VetClinic.Records/Domain.cs` — `Visit.Notes` → `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicCardService.cs` — добавлены `DeleteOwnerAsync`, `ReplaceAllergiesAsync`; `UpdateVisitNotesAsync` → `UpdateVisitAnamnesisAsync`; `VisitDto.Notes` → `VisitDto.Anamnesis`.
- `src/VetClinic.Records/Program.cs` — эндпоинты `DELETE /owners/{id}`, `PUT /pets/{id}/allergies`, `PUT /visits/{id}/anamnesis` (переименован с `/notes`).

## Новые файлы
- `src/VetClinic.Records/Migrations/20261002090000_RenameVisitNotesToAnamnesis.cs`
- `src/VetClinic.Records/Migrations/20261002090000_RenameVisitNotesToAnamnesis.Designer.cs`
- `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs`

## Решения
- **(а)** Soft-delete владельца каскадируется в коде на питомцев/аллергии/визиты одним `SaveChangesAsync` (`Include`+`AsSplitQuery` из-за двух сестринских коллекций у Pet); скрытие из списков/расписания уже обеспечивают существующие `HasQueryFilter`.
- **(б)** `ReplaceAllergiesAsync` мягко удаляет старые аллергии и добавляет ровно присланный список — история не теряется, активный набор точно равен форме.
- **(в)** Переименование через `RenameColumn` (не drop+add) сохраняет данные; поскольку миграция прода выполняется при остановленном приложении, многошаговый expand/contract не нужен.

Важное допущение: в каталоге не было папки `Migrations`, поэтому добавлена только миграция переименования — предполагается, что базовая схема уже развёрнута на проде; это нужно подтвердить с DBA перед прогоном `dotnet ef migrations script`. Также замечен (но не исправлен, вне поручения) риск: FK `Pet→Owner/Allergy→Pet/Visit→Pet` имеют `ON DELETE CASCADE` при soft-delete — стоит обсудить отдельно.

Тот же текст записан в `/home/mmx/.cache/research/runs/0ef7bc/work/_answer.md`.