Все три доработки готовы и записаны в каталог, ответ продублирован в `_answer.md`. Сборку и тесты я не запускал. Полный код файлов — в `src/VetClinic.Records/`.

## Файлы

Изменены:
- `src/VetClinic.Records/Domain.cs`: `Visit.Notes` переименовано в `Visit.Anamnesis`.
- `src/VetClinic.Records/ClinicDbContext.cs`: фильтры зависимых сущностей учитывают удаление их питомца или клиента; у внешних ключей стоит `DeleteBehavior.Restrict`.
- `src/VetClinic.Records/ClinicCardService.cs`: добавлены `DeleteOwnerAsync` и `ReplaceAllergiesAsync`; `UpdateVisitNotesAsync` → `UpdateVisitAnamnesisAsync`; в `VisitDto` поле `Notes` → `Anamnesis`.
- `src/VetClinic.Records/Program.cs`: добавлены `DELETE /owners/{id}` и `PUT /pets/{id}/allergies` (полный список в теле); `PUT /visits/{id}/notes` → `PUT /visits/{id}/anamnesis`.

Созданы:
- `src/VetClinic.Records/Migrations/20261002090000_RenameVisitNotesToAnamnesis.cs`
- `src/VetClinic.Records/Migrations/20261002090100_RestrictDeleteOnMedicalRecords.cs`
- `src/VetClinic.Records/Migrations/ClinicDbContextModelSnapshot.cs`

## Решения

- **Удаление клиента — мягкое, как требует README.** Одна транзакция и set-based `ExecuteUpdate` помечают удалёнными клиента, его питомцев, их аллергии и визиты. Всем ставится одинаковый `DeletedAt`, по нему поддержка восстановит записи вместе. Кроме того, фильтры `Pet`, `Allergy` и `Visit` скрывают записи удалённого питомца или клиента, поэтому расписание врача их не покажет, даже если какую-то запись не пометили. Отдельная миграция убирает `ON DELETE CASCADE`, чтобы случайный физический `DELETE` не стёр историю.
- **Аллергии заменяются без `Clear()`.** При обязательной связи `Clear()` физически удалил бы строки. Вместо этого записи сопоставляются по аллергену без учёта регистра: совпавшие обновляются, лишние помечаются удалёнными, новые добавляются, всё одним `SaveChanges`. Строка питомца блокируется (`FOR UPDATE`) до коммита, поэтому одновременные сохранения формы не задвоят аллергии. Пустой аллерген или дубликаты в списке дают 400.
- **Переименование — `RENAME COLUMN`, данные остаются на месте.** Выкладка штатная: CI собирает из миграций идемпотентный SQL, его запускают в окно обслуживания при остановленном приложении. Ответ API меняется (`notes` → `anamnesis`, другой маршрут), поэтому фронтенд нужно выкатывать вместе с сервисом.

## Что проверить

- В репозитории не было ни папки `Migrations`, ни `.csproj`, поэтому снимок модели написан вручную по текущей модели.
- Имена внешних ключей (`FK_Pets_Owners_OwnerId` и т.п.) взяты по соглашению EF. До выкладки DBA стоит сверить их и `artifacts/migrate.sql` с реальной схемой прода.