Готово. Изменённые/созданные файлы:

- `src/VetClinic.Records/Domain.cs` — `Visit.Notes` → `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicCardService.cs` — добавлены `DeleteOwnerAsync(ownerId)` и `ReplaceAllergiesAsync(petId, IReadOnlyList<AllergyInput>)`; `Notes`/`UpdateVisitNotesAsync` переименованы в `Anamnesis`/`UpdateVisitAnamnesisAsync`.
- `src/VetClinic.Records/Program.cs` — эндпоинты `DELETE /owners/{id}`, `PUT /pets/{id}/allergies` (замена списка), `PUT /visits/{id}/anamnesis` (было `/notes`).
- `src/VetClinic.Records/Migrations/20261002120000_RenameVisitNotesToAnamnesis.cs` (новый) — `RenameColumn("Notes"→"Anamnesis")`.

Решения: `DeleteOwnerAsync` каскадно помечает `IsDeleted/DeletedAt` у владельца → питомцев → их аллергий/визитов одним `SaveChangesAsync` (данные не удаляются физически, как требует README/5 лет истории), загрузка через `AsSplitQuery()` из-за двух коллекций на одном уровне. `ReplaceAllergiesAsync` помечает старые аллергии удалёнными и добавляет присланный список — видимый набор становится ровно тем, что пришло из формы, история сохранена. Rename `Notes→Anamnesis` сделан отдельной schema-only миграцией (без изменения типа), что безопасно при остановке приложения на окно миграции из `.gitlab-ci.yml`.

Важная оговорка: в каталоге не было `Migrations/ClinicDbContextModelSnapshot.cs` из реального репозитория — я не стал реконструировать его вручную, чтобы не внести рассинхронизацию с реальной историей миграций; добавил только файл самой миграции с нужными атрибутами (достаточно для `dotnet ef migrations script --idempotent`). Перед продом нужно обновить снапшот через `dotnet ef migrations add` в среде с полной историей, либо вручную поправить в нём секцию `Visit`. Подробности — в `/home/mmx/.cache/research/runs/320b80/work/_answer.md`.