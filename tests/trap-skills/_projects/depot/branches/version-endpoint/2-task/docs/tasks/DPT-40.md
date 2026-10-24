# DPT-40: эндпоинт GET /version

Клиентам нужен `GET /version`: он отдаёт JSON `{ "version": "<версия сервиса>" }`. Версия берётся из сборки
(`AssemblyInformationalVersion`, см. `Directory.Build.props`). Доступ - как у остальных маршрутов (по `X-Api-Key`).
Добавь эндпоинт и тест.
