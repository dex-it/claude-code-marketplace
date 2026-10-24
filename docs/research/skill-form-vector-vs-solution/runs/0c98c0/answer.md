## Изменённые файлы
- `src/VetClinic.Records/Domain.cs` — `Visit.Notes` → `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicCardService.cs` — добавлены `DeleteOwnerAsync(ownerId)` и `ReplaceAllergiesAsync(petId, IReadOnlyList<AllergyInput>)`; `UpdateVisitNotesAsync` → `UpdateVisitAnamnesisAsync`; `VisitDto.Notes` → `VisitDto.Anamnesis`.
- `src/VetClinic.Records/Program.cs` — добавлены `DELETE /owners/{id}` и `PUT /pets/{id}/allergies` (полная замена), `PUT /visits/{id}/notes` → `PUT /visits/{id}/anamnesis`.

## Новые файлы
- `src/VetClinic.Records/Migrations/20261002090000_RenameVisitNotesToAnamnesis.cs`
- `src/VetClinic.Records/Migrations/20261002090000_RenameVisitNotesToAnamnesis.Designer.cs`
- `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs`
- `_answer.md`

(а) и (б) используют уже принятый в проекте soft-delete + глобальные query-фильтры, поэтому удалённые сущности сами исчезают из всех выборок без правки запросов. (в) — `RENAME COLUMN` безопасен для текущего регламента выкладки (app стоп → DDL → новый деплой), expand/contract не нужен. В репозитории не было папки `Migrations` вовсе, поэтому снапшот модели я восстановил вручную из текущих `Domain.cs`/`ClinicDbContext.cs` — это стоит сверить с `dotnet ef`, как только тулинг станет доступен.