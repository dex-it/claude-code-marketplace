---
name: dotnet-validation
description: Серверная валидация входных DTO - верхняя граница строк, размер коллекций и проверка элементов, подтипы. Активируется при FluentValidation, AbstractValidator, validator, валидация DTO, MaximumLength, RuleFor, RuleForEach, SetInheritanceValidator, лимит длины, размер списка
---

# Server-Side Validation - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Строковое поле без верхней границы длины
- Коллекция без предела размера или без проверки элементов
- Цепочки `When(x is Subtype)` вместо `SetInheritanceValidator`
