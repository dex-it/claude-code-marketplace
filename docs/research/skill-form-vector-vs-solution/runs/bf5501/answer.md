## ✅ Задача выполнена

**Созданные файлы:**
- `CustomerNotifier.cs`

**Решение:**  
Создан класс `CustomerNotifier` с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text)`, который получает ID клиентов из маркетинговой системы, находит их в БД через EF Core, и отправляет письмо каждому через `IEmailSender`. Класс использует dependency injection для получения `ShopDbContext` и `IEmailSender` в конструктор.

Ответ также записан в `_answer.md`.