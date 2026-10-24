# VetClinic.Journal

Журнал приёмов ветклиники «Лапа», филиал в Екатеринбурге (часовой пояс клиники - `Asia/Yekaterinburg`, UTC+5).

Стек: .NET 8, EF Core 8.0.x, Npgsql.EntityFrameworkCore.PostgreSQL 8.0.x, PostgreSQL 16.

- Моменты времени хранятся в UTC; на экраны и в выгрузки выводятся по местному времени клиники.
- Полнотекстовые индексы (GIN) созданы миграциями через `migrationBuilder.Sql`:
  - `ix_visits_complaint_fts` на `"Visits"`: `to_tsvector('russian', "Complaint")`
  - `ix_visits_diagnosis_fts` на `"Visits"`: `to_tsvector('russian', coalesce("Diagnosis", ''))`
  - `ix_prescriptions_drug_fts` на `"Prescriptions"`: `to_tsvector('russian', "Drug")`
