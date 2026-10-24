---
name: dotnet-validation
description: Серверная валидация входных DTO - верхняя граница строк, пределы длины константами, размер коллекций, подтипы, вызов валидатора. Активируется при FluentValidation, AbstractValidator, validator, валидация DTO, MaximumLength, RuleFor, RuleForEach, SetInheritanceValidator, лимит длины, размер списка
---

# Server-Side Validation - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Строковое поле без верхней границы длины
- Пределы длины литералами вместо общих констант
- Коллекция без предела размера или без проверки элементов
- Цепочки `When(x is Subtype)` вместо `SetInheritanceValidator`
- Ручной вызов валидатора в каждом обработчике
