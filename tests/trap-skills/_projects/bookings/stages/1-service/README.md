# Bookings

Сервис бронирования переговорных: комнаты, брони, перенос и отмена. ASP.NET Core (.NET 10),
контроллеры, EF Core + PostgreSQL. Доступ - по ключу в заголовке `X-Api-Key`.

## Запуск

```bash
docker compose up -d                      # PostgreSQL 16 на localhost:5432
dotnet run --project src/Bookings.Api     # http://localhost:5080, окружение Development
```

В Development схема БД создаётся на старте (`Database:Initialize`), заводятся три комнаты, ключи
участников - в `appsettings.Development.json`; Swagger UI - `/swagger`.

Пакеты - только из одобренного перечня `Directory.Packages.props`; `nuget.config` без внешних
источников (восстановление из локального кэша).

## Контракт

Контракт - `api/openapi.yaml` (OpenAPI 3.0.3), меняется вместе с кодом: правка поведения API и
правка контракта - в одном MR, запись - в `api/CHANGELOG.md`. Требования - `docs/requirements/FR.md`.
