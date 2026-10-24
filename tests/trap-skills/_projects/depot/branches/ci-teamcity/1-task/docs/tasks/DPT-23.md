# DPT-23: CI на TeamCity

Нужна конфигурация TeamCity как код: `.teamcity/settings.kts` (Kotlin DSL, сервер 2024.12). Проект `Depot`.

- Цепочка: сборка, тесты (unit и integration), образ и push, деплой на stage, деплой на prod (по кнопке).
- В организации ещё девять сервисов с такой же схемой (Depot - образец): конфигурацию нужно переиспользовать, а не
  копировать девять раз.
- Параметры: пароль БД для integration (`db.password`), пароль реестра образов (`registry.password`), токен деплоя
  (`deploy.token`).
- Деплой берёт артефакт сборки `deploy-values.yaml` и образ, собранные в этой же цепочке.
- Недавние происшествия: на прошлой неделе билд оказался зелёным при том, что тесты не запускались вовсе; в логе под
  нагрузкой видели `System.OutOfMemoryException`, а `dotnet test` всё равно завершился нулём.
- Триггеры: VCS на `main`; PR из форков тоже собираем.
- Для сборки используются `dotnet restore`, `dotnet build`, `dotnet test`, `dotnet publish`; агенты - Linux с Docker.
