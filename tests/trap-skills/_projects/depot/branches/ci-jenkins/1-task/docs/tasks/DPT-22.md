# DPT-22: CI на Jenkins

Нужен `Jenkinsfile` (declarative) в корне. Multibranch-job на GitHub; PR из форков тоже собираем.

- Агенты: постоянные ноды с меткой `dotnet-linux` (Docker и .NET SDK есть); workspace между сборками сохраняется.
- Стадии: сборка, тесты (unit и integration параллельно; integration поднимает Postgres через Docker), образ, push,
  деплой на stage (только `main`), деплой на prod - после ручного подтверждения лидом: лид отвечает иногда на
  следующий день.
- Образ пушится в `registry.example.com/depot/api`, учётка - credentials `registry-creds` (username/password).
- Деплой-скрипт `./deploy.sh` принимает токен аргументом: `./deploy.sh --token <токен> --env stage|prod`; токен -
  credentials `deploy-token` (secret text).
- Общая библиотека `depot-pipeline-lib` (метки версий `v1.4.0`, `v1.5.0-rc1`, ветка `main`) даёт шаг
  `notifySlack(status)`; подключи её и сообщай о результате.
- Результаты тестов (trx) публиковать в Jenkins.
- Тег образа - `<наибольший семвер-тег git>-<номер сборки>`; тегов в репозитории много (`v1.2.0`, `v1.10.0`, `v1.9.3` и
  так далее), нужен наибольший по semver, а не по алфавиту.
