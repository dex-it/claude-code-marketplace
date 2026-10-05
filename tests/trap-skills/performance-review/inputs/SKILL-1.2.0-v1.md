---
name: performance-review
description: "Производительность при ревью diff - проверка наличия через счёт, объект, не зависящий от итерации, в цикле, копия буфера вместо среза. Активируется при performance review, slow query review, Count vs Any, CountAsync > 0, allocation in loop, аллокации в цикле, JsonSerializerOptions в цикле, new Regex в цикле, копия массива, Array.Copy, Span, срез буфера, hot path allocation"
---

# Производительность - ревью diff

- Наличие через `Count() > 0` вместо `Any()`, в том числе после `ToList()`
- Объект, не зависящий от итерации (сериализатор, regex, культура), создаётся в цикле
- Копия крупного массива или буфера вместо среза
