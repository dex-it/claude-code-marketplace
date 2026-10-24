Задача SW-261 сделана в рабочем дереве, без коммита. Код и тесты не запускались, потому что окружения Python нет.

## Изменённые файлы
- `src/shelfwatch/sentiment_train.py` — новый.
- `tests/test_sentiment_train.py` — новый.
- `README.md` — добавлена строка про модуль в таблицу.

## Описание MR: SW-261, тональность отзывов и сводчик

**Тональность (`rubert-base-cased`)**
- `train_sentiment()` берёт разбиение из колонки `split`.
- Тексты токенизируются пачкой одним вызовом токенизатора, не по одному в цикле. Padding динамический, через `DataCollatorWithPadding`.
- Отзывы до 600 токенов обрезаются до 512, это предел позиций BERT.
- Прогрев задан через `warmup_steps=0.1` (доля шагов). Поля `warmup_ratio` в `TrainingArguments` нет.
- Лучшая эпоха выбирается по macro-F1 из `shelfwatch.metrics`.
- Модель и токенизатор сохраняются в `artifacts/sentiment/`.
- `classify(texts) -> list[int]` грузит модель из этого каталога на CPU, с `local_files_only=True`, и обрабатывает пачками по 32. Пустой список возвращает `[]` без загрузки модели.
- Квантование не применялось: в задаче нет числового бюджета задержки.

**Сводчик (`Qwen2.5-7B-Instruct`)**
- `train_summarizer()` делает QLoRA: база в 4-bit nf4, LoRA r=16 на всех линейных проекциях, gradient checkpointing, bf16, batch 1 с накоплением 16. Это рассчитано на одну GPU на 24 ГБ.
- Loss считается только по токенам сводки, токены промпта замаскированы.
- После обучения адаптер вливается в базу в bf16 (`merge_and_unload`), и итоговая модель сохраняется в `artifacts/summarizer/`. Поэтому сервису разметки `peft` не нужен. `peft` и `bitsandbytes` импортируются только внутри `train_summarizer`.
- `summarize(reviews) -> list[str]` грузит влитую модель локально и генерирует пачками по 8 со `left`-padding. Генерация жадная, но с ограничением повторов: `repetition_penalty=1.1`, `no_repeat_ngram_size=4`, `max_new_tokens=128`.
- Прогрев задан через `warmup_steps=0.03`.

**Тесты (без весов)**
- Проверяют `split_frame`, `build_prompt` и маскирование промпта в данных сводчика.
- Проверяют, что `classify([])` и `summarize([])` не грузят модель.
- Проверяют, что в коде нет `warmup_ratio` и нет `peft` на уровне модуля.

**Допущения, которые нужно проверить**
- Схема `data/summaries.parquet` нигде не описана. Я предположил колонки `review`, `summary` и `split`. Если они называются иначе, правка нужна в `train_summarizer`.
- `pyproject.toml` в репозитории нет, поэтому зависимости (`transformers>=5.15`, `peft`, `bitsandbytes`, `torch`) не закреплены. Их нужно добавить отдельно.
- Гиперпараметры (эпохи, lr) выбраны стандартные и не подбирались.

Запуск: `python -m shelfwatch.sentiment_train [sentiment|summarizer]`.
