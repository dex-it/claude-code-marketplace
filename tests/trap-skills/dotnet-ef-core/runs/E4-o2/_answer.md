Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs/E4-O2/Model.cs
- /Users/anonymous/.cache/review/pr280/runs/E4-O2/OrderRepository.cs

Что сделано:
- Order.Complexity (int, 1..5): свойство + IsRequired() + CHECK-constraint CK_Order_Complexity_Range на уровне БД (диапазон валидируется не только в коде).
- CreatedAt: колонка осталась timestamp without time zone (не трогал), но добавил HasConversion — на запись гашу Kind в Unspecified после ToUniversalTime(), на чтение ставлю Kind=Utc обратно. Это обходит запрет Npgsql 6+ на запись Kind=Utc в timestamp без TZ и гарантирует, что в коде CreatedAt всегда UTC независимо от таймзоны клиента.
- Order -> Items и Order -> Payments: явно настроены в OnModelCreating через HasMany().WithOne().HasForeignKey(...).OnDelete(DeleteBehavior.Restrict) — так как Order помечается как удалённый (IsDeleted), а не удаляется физически, Restrict защищает от случайного каскадного сноса Items/Payments, если кто-то всё же выполнит физический DELETE по Order.
- OrderRepository.ClearItemsAsync(Guid orderId): выбирает OrderItem по orderId и удаляет их через RemoveRange + SaveChangesAsync — намеренно не через Order.Items.Clear(), поскольку OrderId — required FK и при Restrict "открепление" через навигацию непредсказуемо; явное удаление строк работает независимо от DeleteBehavior связи.
