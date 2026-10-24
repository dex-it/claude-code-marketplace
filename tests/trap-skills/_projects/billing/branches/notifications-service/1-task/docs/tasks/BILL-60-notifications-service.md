# BILL-60: Каркас сервиса уведомлений

Уведомления клиентам о счетах выносятся из Billing в отдельный сервис. Сейчас нужен только каркас,
бизнес-логика - следующими задачами.

- Каталог `services/notifications` в этом репозитории: решение `Billing.Notifications.sln`, проекты
  `Notifications.Api` (ASP.NET Core 8, эндпоинт `GET /health`), `Notifications.Domain`,
  `Notifications.Infrastructure`, `Notifications.Tests` (xUnit, один тест на `/health`).
- Домен не зависит ни от инфраструктуры, ни от Api.
- Общая конфигурация сборки - одна на все проекты сервиса.
- Пайплайн CI в GitHub Actions (`.github/workflows/notifications.yml`) на push и pull request,
  затрагивающие `services/notifications/**`.

Вне задачи: Dockerfile, деплой, бизнес-логика.
