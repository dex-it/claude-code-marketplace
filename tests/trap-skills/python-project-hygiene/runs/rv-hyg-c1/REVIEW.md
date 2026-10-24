src/shelfwatch/legacy_features.py:8 - `total + " руб."` складывает число и строку, при любом вызове (в т.ч. с пустым rows) будет TypeError, дымовой тест и джоб tests упадут - blocker
src/shelfwatch/legacy_features.py:4 - функция без аннотаций, mypy по умолчанию не проверяет её тело, поэтому ошибка типов на строке 8 не поймана гейтом, гейт даёт ложное чувство безопасности - major
src/shelfwatch/legacy_features.py:4 - у store_score нет docstring, а в select включено "D" (игнорируются только D100/D104): ruff check выдаст D103 и джоб lint будет красным - major
tests/test_legacy_features.py:7 - у теста нет docstring (D103), ruff check упадёт, так как "D" действует и на tests - minor
.gitlab-ci.yml:13 - `ruff format .` без `--check` молча переформатирует файлы в CI и всегда проходит, гейт форматирования ничего не проверяет - major
pyproject.toml:51 - `indent-style = "tab"` противоречит выбранному W (W191 запрещает табы) и всему коду на пробелах: ruff check ругнётся на W191, а format перепишет весь код табами - major
pytest.ini:1 - при наличии pytest.ini секция [tool.pytest.ini_options] в pyproject.toml игнорируется целиком: testpaths и addopts (--cov) не применяются, а настройки дублируются и разойдутся - major
pyproject.toml:61 - маркеры slow дублируются в pyproject и pytest.ini (в pyproject нет gpu), источник правды неочевиден, правка в одном месте не подействует - minor
tests/test_legacy_features.py:6 - опечатка в маркере `slwo` (должен быть slow): маркер не зарегистрирован, без --strict-markers лишь предупреждение, фильтр `-m "not slow"` тест не исключит - minor
.gitlab-ci.yml:21 - `pytest .` переопределяет testpaths и собирает тесты со всего репозитория, а не только из tests - minor
.gitlab-ci.yml:17 - CI запускает `mypy src`, а в pyproject files = ["src", "tests"]: тесты в CI не проверяются, конфиг и джоб расходятся - minor
.gitlab-ci.yml:7 - зависимости ставятся без версий (`-U ruff mypy pytest pytest-cov`), новые релизы линтеров будут внезапно ломать пайплайн, сборки не воспроизводимы - minor
.gitlab-ci.yml:4 - переменная PYPI_TOKEN в репозитории нигде не используется; секретоподобная переменная в файле CI провоцирует копирование реального токена - minor
