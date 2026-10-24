---
name: python-project-hygiene
description: Гигиена Python-проекта - ruff против форматтера, ignore_missing_imports в mypy, порог покрытия, эскалация предупреждений pytest, аудит зависимостей. Активируется при ruff, mypy, pytest, pyproject.toml, линтер python, проверка типов, filterwarnings, cov-fail-under, pip-audit, гейты качества python-проекта
---

# Гигиена Python-проекта - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Правило `ruff` из списка конфликтующих с форматтером выбрано без `ignore`
- `ignore_missing_imports` включён на весь проект
- Покрытие измеряется, порога `--cov-fail-under` нет
- Предупреждения pytest не эскалируются в ошибки (`filterwarnings`)
- В CI нет шага аудита зависимостей
