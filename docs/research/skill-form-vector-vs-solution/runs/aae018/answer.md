Готово! Вот итоговый отчёт:

## Созданные/изменённые файлы
- **CustomerNotifier.cs** (создан)

## Описание решения
Реализован класс `CustomerNotifier` с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct)`, который получает список ID клиентов из маркетинговой системы, находит их в БД через `ShopDbContext`, и отправляет письмо каждому клиенту через `IEmailSender`. Метод асинхронный с поддержкой отмены операции (CancellationToken).

Тот же ответ записан в `_answer.md`.