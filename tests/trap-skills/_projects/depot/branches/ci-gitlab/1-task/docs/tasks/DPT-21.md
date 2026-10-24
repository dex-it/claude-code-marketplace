# DPT-21: CI на GitLab CI

Нужен `.gitlab-ci.yml` в корне. Стадии: сборка, тесты, образ, деплой.

- Раннеры: общие shared (docker executor, теги не нужны) и выделенный с тегом `depot-deploy` (доступ в кластер).
- Сборка и тесты .NET 8 на MR и на ветках `main` и `develop`. Интеграционным тестам нужен Postgres 16 (service
  контейнер), строка подключения - `Host=postgres`.
- Покрытие тестов должно показываться в MR: сборщик отчёта (`reportgenerator -reporttypes:TextSummary`) печатает в лог
  строку вида `Line coverage: 83.4%`.
- Образ собирается docker-in-docker и пушится в `$CI_REGISTRY_IMAGE`.
- Stage: автодеплой после `main` (`kubectl set image deployment/depot-api api=<образ> -n depot-stage`). Prod: после stage,
  `kubectl set image ... -n depot`. Kubeconfig - переменная `KUBECONFIG_B64`, пароль БД для миграций -
  `DB_MIGRATION_PASSWORD` (обе заведены в настройках проекта как protected и masked).
- Разработчикам для разбора проблем деплоя нужны в логе джобы настройки, с которыми шёл деплой.
- Внешние контрибьюторы присылают MR из форков.
