Сделал все три доработки и записал этот же ответ в `_answer.md`. Сборку и тесты не запускал. Новые и изменённые файлы целиком лежат в каталоге проекта.

## Файлы

Изменены:
- `src/VetClinic.Records/Domain.cs` — `Visit.Notes` → `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicDbContext.cs` — внешние ключи питомцев, аллергий и визитов: `OnDelete(Restrict)` вместо каскада.
- `src/VetClinic.Records/ClinicCardService.cs` — новые методы `DeleteOwnerAsync` и `ReplaceAllergiesAsync`; `UpdateVisitNotesAsync` переименован в `UpdateVisitAnamnesisAsync` и теперь возвращает `false`, если визит не найден; в `VisitDto` поле `Notes` → `Anamnesis`.
- `src/VetClinic.Records/Program.cs` — новые эндпоинты `DELETE /owners/{id}` и `PUT /pets/{id}/allergies` (тело — полный список); `PUT /visits/{id}/notes` → `PUT /visits/{id}/anamnesis`; если запись не найдена, возвращается 404.

Созданы:
- `src/VetClinic.Records/Migrations/20261002090000_RestrictCascadeOnMedicalRecords.cs` — пересоздаёт три внешних ключа с `RESTRICT` вместо `CASCADE`.
- `src/VetClinic.Records/Migrations/20261002090100_RenameVisitNotesToAnamnesis.cs` — `RenameColumn` (не drop + add), данные сохраняются.
- `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs`
- `_answer.md`

## Решения

- **Удаление клиента** — мягкое, как требует README: клиент, его питомцы и их запланированные визиты помечаются удалёнными одной транзакцией через `ExecuteUpdate` и с одинаковым `DeletedAt`. Поддержка сможет восстановить всё разом. Внешние ключи в БД переведены на `RESTRICT`, чтобы случайное физическое удаление не стёрло историю каскадом.
- **Замена аллергий** — по разнице, а не через `Clear()`: при `Restrict` очистка коллекции бросает исключение. Совпадающие записи остаются как есть, лишние помечаются удалёнными, новые добавляются. Строка питомца блокируется `SELECT … FOR UPDATE` внутри транзакции, поэтому два одновременных сохранения формы не создадут дубли.
- **Выкладка на прод** — через существующий пайплайн: идемпотентный SQL-скрипт → ревью DBA → `db-migrate` в окно обслуживания. `Database.Migrate()` при старте не добавлял: у роли `vet_app` нет прав на изменение схемы.

## Что проверить

- **Snapshot миграций написан вручную.** В репозитории не было ни каталога `Migrations`, ни `.csproj`, хотя README на этот каталог ссылается. Snapshot нужно сверить командой `dotnet ef migrations has-pending-model-changes`. Если базовые миграции лежат где-то ещё, мои файлы нужно перенести туда.
- **Меняется API:** поле `notes` → `anamnesis` в JSON и путь `/notes` → `/anamnesis`. Фронтенд нужно выкатывать вместе с этим изменением.