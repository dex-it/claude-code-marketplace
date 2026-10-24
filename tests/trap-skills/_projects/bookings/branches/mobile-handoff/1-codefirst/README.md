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

Контракт - swagger.json, генерируется Swashbuckle из кода: `/swagger/v1/swagger.json` (Development).
Ручной `api/openapi.yaml` больше не ведём. История версий до перехода -
`api/CHANGELOG.md`. Требования - `docs/requirements/FR.md`.
