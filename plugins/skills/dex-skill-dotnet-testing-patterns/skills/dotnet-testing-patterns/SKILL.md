---
name: dotnet-testing-patterns
description: .NET unit-тесты - проверка поведения вместо вызовов моков, мок, возвращающий мок. Активируется при unit test, xunit, moq, mock, Verify, Setup, Returns, тест на моках, хрупкий тест, тест ломается при рефакторинге, Arrange Act Assert
---

# Testing Patterns - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Тест проверяет только вызовы моков (`Verify`), а не результат
- Мок возвращает мок
