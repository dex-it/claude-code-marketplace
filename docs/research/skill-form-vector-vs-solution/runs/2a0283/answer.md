Готово! Вот краткое резюме выполненной работы:

## Созданные/изменённые файлы

1. **Model.cs** — Добавлено поле `Complexity` в Order, настроен value converter для CreatedAt (UTC нормализация через SpecifyKind), установлены отношения с ClientCascade для Items и Payments
2. **OrderRepository.cs** — Добавлен метод `ClearItemsAsync()` с ExecuteDeleteAsync для массового удаления позиций
3. **_answer.md** — Документация решения

## Решения

- **Complexity**: целое поле 1–5, настроено в OnModelCreating. **CreatedAt UTC**: value converter пишет `ToUniversalTime() → SpecifyKind(Unspecified)`, читает `SpecifyKind(Utc)` — код видит UTC, колонка остаётся `timestamp without time zone`. **Soft-delete**: ClientCascade на Items и Payments блокирует физический CASCADE DELETE при Order.IsDeleted=true.