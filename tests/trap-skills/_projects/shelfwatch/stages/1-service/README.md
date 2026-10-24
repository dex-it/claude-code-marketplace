# shelfwatch

Аналитика полок розничной сети. Python 3.12, зависимости закреплены в `pyproject.toml`
(`uv sync`), лок-файла пока нет. Контур:

| Модуль | Что делает | Данные |
|---|---|---|
| `shelfwatch.torch_train` | классификатор фото полок (PyTorch, ResNet-18), 3 класса: full, empty, misplaced | `data/shelf/{train,val}/<класс>/*.jpg`, 600 снимков |
| `shelfwatch.detect` | детекция товаров на полке | те же снимки + разметка YOLO в `data/shelf/labels/` |
| `shelfwatch.keras_train` | классификатор категории SKU (Keras, MLP), 10 классов | `data/sku.parquet`, 120 000 строк |
| `shelfwatch.baseline` | бейзлайн оттока магазинов (sklearn, XGBoost) | `data/accounts.parquet`, 30 000 строк, отток 5%, срез по месяцам 2024-01..2026-09 |
| `shelfwatch.finetune` | тональность отзывов (HF, дообучение BERT) | `data/reviews.parquet`, 8 000 отзывов |
| `shelfwatch.tune` | подбор гиперпараметров (Optuna) | как у модуля, который тюнится |

Тесты: `pytest`. Задачи - в `docs/tasks/`. Данные в репозиторий не кладутся.
