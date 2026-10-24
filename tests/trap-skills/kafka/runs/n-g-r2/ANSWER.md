Скидка за объём реализована в домене. Ничего не собиралось и не запускалось (доступен только git), поэтому тесты не проверены. Версии пакетов для тестов (`Microsoft.NET.Test.Sdk` 17.14.1, `xunit` 2.9.3, `xunit.runner.visualstudio` 3.1.0) я указал по памяти, их нужно сверить при первой сборке.

**Изменённые файлы:**
- `src/Fulfil/Domain/VolumeDiscount.cs` (новый): правило скидки.
- `src/Fulfil/Domain/Order.cs`: добавлено `TotalWithDiscount`.
- `tests/Fulfil.Tests/Fulfil.Tests.csproj` и `tests/Fulfil.Tests/VolumeDiscountTests.cs` (новые): xUnit-проект и тесты правила.
- `Directory.Packages.props`: версии тестовых пакетов.
- `Fulfil.sln`: добавлен тестовый проект.

**Решения:**
- Правило — чистая статическая функция в домене без обращений к хранилищам и брокерам. Пороги 10 000 и 50 000 входят в диапазон скидки. Сумма со скидкой считается в `decimal` и округляется вниз до копеек (`MidpointRounding.ToZero`). `Order.Total` не менялся.
- `TotalWithDiscount` — свойство только для чтения. Если записи заказа хранятся в Mongo, оно не попадёт в документ, и старые документы это не затронет.
- Пункты дисциплины (Redis, Kafka, RabbitMQ, MongoDB, Elasticsearch) к этой задаче не относятся: хранилищ, брокеров и событий в ней нет.
