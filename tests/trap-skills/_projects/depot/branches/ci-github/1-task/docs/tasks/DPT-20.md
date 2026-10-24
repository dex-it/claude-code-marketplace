# DPT-20: CI на GitHub Actions

Нужен CI в `.github/workflows/`. Репозиторий на GitHub, организация `dex`.

1. На каждый PR и на push в `main`: сборка и тесты (.NET 8, раннеры GitHub-hosted `ubuntu-latest`). Интеграционным
   тестам нужен Postgres (Testcontainers, то есть Docker). `Depot.Contracts` используют и Windows-клиенты: тесты
   категории `Contracts` гоняем на ubuntu и на windows.
2. Форматирование (`dotnet format`): в коде пока 300+ замечаний, чинить будем постепенно, а отчёт о них нужен уже
   в каждом PR; релиз пока не блокируем.
3. Результаты тестов и покрытие сохраняются артефактами прогона.
4. PR принимаем и из форков. На PR бот-workflow ставит метку размера (`size/S`, `size/M`, `size/L`) по числу
   изменённых строк.
5. На `main`: сборка образа и push в `registry.example.com/depot/api` (логин - секреты `REGISTRY_USER`,
   `REGISTRY_PASSWORD`), затем запуск деплоя на stage: деплой-workflow `deploy.yml` лежит в другом репозитории,
   `dex/depot-infra` (триггер `workflow_dispatch`).
6. Проверка лицензий зависимостей - готовый reusable workflow `ci-shared/.github/.github/workflows/license-check.yml@v2`,
   вызывается после тестов.
7. В компании есть self-hosted раннеры с меткой `depot-linux` (в сети компании); быстрые сборки можно гонять на них.
