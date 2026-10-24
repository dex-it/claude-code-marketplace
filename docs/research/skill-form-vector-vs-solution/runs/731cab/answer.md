Готово! Выполнены все поручения:

**Изменённые файлы:**
- **Model.cs**: добавлено свойство `Complexity`, настроен value converter CreatedAt для UTC (запись → Unspecified, чтение → Utc), добавлены связи Order → Items/Payments с DeleteBehavior.Restrict
- **OrderRepository.cs**: добавлен метод `ClearItemsAsync(Guid orderId)`

**Решения:** Complexity — простое свойство (Owned-Type не нужен для одного поля, это overhead). CreatedAt сохраняет семантику UTC в коде через конвертер, колонка остаётся `timestamp without time zone`. Soft-delete защищён от каскадного удаления Items/Payments через `Restrict`.

Ответ записан в `/Users/anonymous/.cache/research/runs/731cab/work/_answer.md`.