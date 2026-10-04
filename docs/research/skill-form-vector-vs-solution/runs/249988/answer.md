Готово! Создал `CustomerNotifier.cs` с методом `NotifyCustomers`.

**Созданный файл:**
- `CustomerNotifier.cs` — класс с методом, отправляющим письма через IEmailSender

**Ключевые решения:**
1. **Дедупликирую ID** перед `Contains()` — защита от дублей из маркетинговой системы
2. **Один запрос к БД** (`Where().Select().ToListAsync()`) вместо цикла с FindAsync — экономим сетевые roundtrip'ы и загружаем только Email
3. **Guard на пустой список** — выход, если нечего отправлять

Результат записан в `/Users/anonymous/.cache/research/runs/249988/work/_answer.md`