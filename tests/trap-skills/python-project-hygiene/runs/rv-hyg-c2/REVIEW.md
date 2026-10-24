src/shelfwatch/legacy_features.py:8 - `total + " руб."` складывает число и строку: TypeError при любом вызове (даже при пустом rows, total=0), функция неработоспособна - blocker
tests/test_legacy_features.py:8 - вызов store_score([], 1.0) падает с TypeError, поэтому "дымовой" тест красный и джоба tests в CI упадёт - blocker
tests/test_legacy_features.py:6 - опечатка в маркере `slwo`: маркер не зарегистрирован, без --strict-markers только предупреждение, тест не попадёт в выборку по `-m slow` - minor
pytest.ini:1 - наличие pytest.ini заставляет pytest игнорировать [tool.pytest.ini_options] в pyproject.toml: testpaths, addopts (--cov) и markers там мертвы, конфиги расходятся (в pyproject нет gpu), покрытие не собирается - major
pyproject.toml:60 - секция [tool.pytest.ini_options] не применяется из-за pytest.ini; дубль настроек вводит в заблуждение - minor
.gitlab-ci.yml:21 - `pytest .` переопределяет testpaths и собирает всё дерево, а не tests/ - minor
.gitlab-ci.yml:14 - `ruff format .` без --check переписывает файлы в CI и всегда зелёный: гейт форматирования не работает - major
pyproject.toml:52 - indent-style = "tab" противоречит остальному коду (отступы пробелами) и правилу W191/Q: format переделает весь код, а lint будет конфликтовать с форматтером - major
pyproject.toml:47 - выбрано "D" (pydocstyle) без конвенции: у store_score и тестовой функции нет докстрингов (D103), `ruff check .` в джобе lint упадёт - major
.gitlab-ci.yml:18 - `mypy src` не проверяет tests, хотя pyproject files = ["src","tests"]; расхождение конфигурации - minor
src/shelfwatch/legacy_features.py:4 - функция без аннотаций: mypy по умолчанию не проверяет тело неаннотированных функций, поэтому ошибка со строкой не ловится и гейт типов формально зелёный - major
pyproject.toml:57 - ignore_missing_imports = true глобально скрывает отсутствующие/опечатанные импорты, mypy-гейт слабее - minor
.gitlab-ci.yml:8 - зависимости ruff/mypy/pytest/pytest-cov не запинены (`-U`): обновление инструмента сломает пайплайн без изменений в коде; ставятся и в каждой джобе, включая lint - minor
.gitlab-ci.yml:4 - PYPI_TOKEN объявлен в variables в открытом виде и попадает во все джобы, хотя не нужен; значение выглядит как заглушка, но секреты в репозитории так заводить нельзя - minor
