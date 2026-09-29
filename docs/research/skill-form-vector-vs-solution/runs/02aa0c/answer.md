Все четыре пункта (а–г) сделаны, но сборку и тесты я не запускал, так что код не проверен.

Изменённые файлы:
- `Model.cs`: добавлены `Order.Complexity`, навигации `OrderItem.Order` и `Payment.Order`, а в `OnModelCreating` — конфигурация.
- `OrderRepository.cs`: добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md`: этот же ответ.

Решения:
- **Complexity** — обычная колонка `int` (owned-тип ради одного поля не нужен), диапазон 1..5 закреплён ограничением `CK_Orders_Complexity`. Миграцию я не создавал. В ней существующим строкам нужно проставить 1 до добавления CHECK, иначе значение 0 его нарушит.
- **CreatedAt** — колонка остаётся `timestamp without time zone`. Конвертер записывает UTC как `Unspecified` (Npgsql 8 отказывается писать `Kind=Utc` в такую колонку), а при чтении возвращает `Kind=Utc`.
- **Связи и мягкое удаление** — у Items стоит Cascade, у Payments — Restrict: при ручном физическом удалении платежи не должны пропасть вместе с заказом. У зависимых сущностей такой же фильтр запроса, как у заказа. `ClearItems` загружает позиции и удаляет их через `RemoveRange` (не через `Clear()` на required-связи), затем `SaveChanges`. Если заказа нет или он удалён, метод возвращает `false`.

Уже существующая проблема, я её не трогал: при `UseLazyLoadingProxies` все навигации должны быть `virtual`, а `Customer.Orders`, `Order.Items` и `Order.Payments` сейчас не `virtual`. С такими прокси модель, скорее всего, не соберётся, пока их не сделают `virtual` или не включат `IgnoreNonVirtualNavigations`.