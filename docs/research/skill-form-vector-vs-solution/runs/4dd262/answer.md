Готово. Выполнены все четыре задачи:

**Измененные файлы:** Model.cs, OrderRepository.cs

**Краткие решения:**
- **(а)** Добавлено `int Complexity { get; set; }` для хранения сложности комплектации (1..5)
- **(б)** ValueConverter в OnModelCreating: при чтении из БД `DateTime.SpecifyKind()` устанавливает Kind=Utc, гарантируя работу в UTC в коде
- **(в)** Явно настроены связи Order→Items и Order→Payments с `DeleteBehavior.Restrict`, обеспечивая корректное поведение при мягком удалении
- **(г)** Метод `ClearItems()` удаляет все позиции заказа и вызывает `SaveChangesAsync()`

Ответ записан в _answer.md.