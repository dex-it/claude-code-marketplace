# Fulfil

Сервис исполнения заказов интернет-магазина: принимает заказы от витрины, ведёт проекции
в MongoDB, держит поиск по каталогу и платёжный процесс. .NET 10, ASP.NET Core.

## Стенд

`docker compose up -d` поднимает Kafka (с Schema Registry), RabbitMQ, Redis, MongoDB и
Elasticsearch, по одному узлу. Адреса - `src/Fulfil/appsettings.json`.

## Клиенты

Версии - `Directory.Packages.props` (центральное управление пакетами), пакеты пишутся без версии
в `Fulfil.csproj`. Решения по стеку - `docs/adr/`.

## Задачи

`docs/tasks/FUL-<номер>.md`.
