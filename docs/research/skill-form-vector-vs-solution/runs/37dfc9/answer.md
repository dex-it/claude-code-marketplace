**Готово!**

**Созданные файлы:**
- `CustomerNotifier.cs` — класс с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text)`

**Решение:** IEnumerable материализуется в HashSet (удаляет дубли и обеспечивает безопасный обход), customers загружаются один раз из БД, письма отправляются в цикле. Учтены ловушки SKILL.md: дубли id, запросы в цикле, повторный обход.