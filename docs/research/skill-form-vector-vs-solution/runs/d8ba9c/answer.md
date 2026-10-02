Готово! Изменены Model.cs и OrderRepository.cs, результаты в _answer.md.

**Краткий итог:**
- **(а) Complexity:** добавлено поле int с дефолтом 1
- **(б) CreatedAt:** настроено HasConversion для преобразования UTC↔Unspecified, колонка не меняется
- **(в) Soft-delete:** добавлены IsDeleted в Items/Payments, HasQueryFilter и DeleteBehavior.Cascade в OnModelCreating
- **(г) ClearItems:** метод устанавливает IsDeleted=true для всех позиций заказа