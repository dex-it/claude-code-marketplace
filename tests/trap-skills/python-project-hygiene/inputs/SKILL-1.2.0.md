---
name: python-project-hygiene
description: Гигиена Python-проекта - ignore_missing_imports в mypy, порог покрытия, эскалация предупреждений pytest, аудит зависимостей. Активируется при mypy, pytest, pyproject.toml, проверка типов, ignore_missing_imports, filterwarnings, cov-fail-under, pytest-cov, pip-audit, аудит зависимостей, покрытие тестами, гейты качества python-проекта
---

# Гигиена Python-проекта - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- `ignore_missing_imports` включён на весь проект
- Покрытие измеряется, порога `--cov-fail-under` нет
- Предупреждения pytest не эскалируются в ошибки (`filterwarnings`)
- В CI нет шага аудита зависимостей
