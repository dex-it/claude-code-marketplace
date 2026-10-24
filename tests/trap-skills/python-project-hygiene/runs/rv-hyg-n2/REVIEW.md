src/shelfwatch/legacy_features.py:8 - `total + " руб."` складывает число и строку, в том числе при пустом `rows` (0 + str): TypeError, дымовой тест падает, а на реальных данных функция не работает; mypy не заметит, т.к. функция без аннотаций - blocker
pytest.ini:1 - при наличии pytest.ini pytest не читает `[tool.pytest.ini_options]` из pyproject.toml: `addopts` (покрытие) и `testpaths` молча не действуют, секция в pyproject.toml мёртвая, а набор маркеров в двух местах расходится (в pyproject нет `gpu`) - major
pyproject.toml:46 - в `select` включены `W` и `Q` и `D` без `ignore` для правил, конфликтующих с форматтером (W191, Q000/Q003, D206, D300); при `indent-style = "tab"` (строка 51) `ruff check` ругается на код, который отформатировал `ruff format`, джоб lint краснеет или вечно правит друг друга - major
pyproject.toml:56 - `ignore_missing_imports = true` на весь проект: отсутствующие или опечатанные импорты (torch, xgboost, opencv и т.д.) становятся `Any`, mypy перестаёт ловить ошибки на границе с библиотеками - major
pyproject.toml:60 - покрытие измеряется (`--cov`), но нет `--cov-fail-under`: покрытие может падать до нуля, а CI останется зелёным (при этом addopts сейчас вообще не применяется из-за pytest.ini) - major
pytest.ini:1 - нет `filterwarnings = error`: DeprecationWarning и FutureWarning из pandas/numpy/torch не станут ошибками и накопятся до поломки при апгрейде - major
pytest.ini:1 - нет `--strict-markers`: опечатка в маркере проходит без ошибки - minor
tests/test_legacy_features.py:6 - маркер `slwo` (опечатка от `slow`): без strict-markers тест не попадёт в `-m slow`, при этом дымовой тест и не должен быть slow - минимум предупреждение PytestUnknownMarkWarning, которое не эскалируется - minor
.gitlab-ci.yml:1 - в CI нет шага аудита зависимостей (pip-audit есть в dev-группе, но не вызывается): уязвимые версии пинов попадут в релиз незамеченными - major
.gitlab-ci.yml:13 - `ruff format .` без `--check` переписывает файлы в рабочей копии CI и всегда завершается успехом: нарушения форматирования не блокируют MR - major
.gitlab-ci.yml:7 - `pip install -U ruff mypy pytest pytest-cov` ставит последние версии мимо пинов из `[dependency-groups].dev`: результаты CI расходятся с локальными и меняются без коммита - minor
.gitlab-ci.yml:21 - `pytest .` перекрывает `testpaths`; и `pip install -e .` в before_script тянет torch/tensorflow/и др. в каждый из трёх джобов, включая lint, - долгий и дорогой CI - minor
.gitlab-ci.yml:4 - токен `PYPI_TOKEN` лежит в variables в репозитории (сейчас помечен как фейковый, но шаблон приучает хранить секреты в файле, и он нигде не используется) - minor
.gitlab-ci.yml:17 - `mypy src` расходится с `files = ["src", "tests"]` в pyproject: тесты в CI не проверяются типами - minor
src/shelfwatch/legacy_features.py:4 - у публичной функции нет docstring, при `D` в select это D103, `ruff check .` падает (так же у теста в tests/test_legacy_features.py:7); `D100`/`D104` игнорируются, `D103` нет - major
