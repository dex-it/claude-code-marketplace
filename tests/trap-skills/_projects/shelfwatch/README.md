# Мини-проект Shelfwatch: вход наборов группы 4.5

Аналитика полок розничной сети на Python 3.12 (`pyproject.toml`, все версии закреплены `==`): фото полок
(PyTorch, ResNet), SKU (Keras), отток магазинов (sklearn, XGBoost), отзывы (HF, LoRA), подбор параметров
(Optuna). Вход наборов [python-project-hygiene](../../python-project-hygiene/README.md),
[python-pytorch](../../python-pytorch/README.md), [python-tensorflow](../../python-tensorflow/README.md),
[python-classical-ml](../../removed/python-classical-ml/README.md), [python-computer-vision](../../python-computer-vision/README.md),
[python-nlp-transformers](../../python-nlp-transformers/README.md), [python-ml-optimization](../../python-ml-optimization/README.md)
(эпик #291, группа 4.5, #306). Файл - ключ для судьи, исполнителю не подаётся: `setup.sh` его в каталог
прогона не копирует, как и раннер.

```
setup.sh <dest> [ветка]   git-репозиторий прогона: stages/* - коммиты main, branches/<имя>/<n>-* - ветка feature/<имя>
stages/                   1 каркас: pyproject (закреплённые версии), метрики, docs/data.md - описание данных
branches/                 по кейсу, таблица ниже
run-group-4-5.sh          раннер: промпты кейсов дословно, флаги исполнителя, выход в runs/ протокола
```

## Среда прогона

`claude -p --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config --no-session-persistence
--disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3`, инструменты Read, Write, Edit,
Glob, Grep, Bash; разрешён только `Bash(git *)`. Скилл подаётся копией в `<work>/discipline/<скилл>.md` через
`--add-dir` и строкой промпта «Перед работой прочитай <путь> - дисциплина, принятая в команде»; `Skill` tool
запрещён промптом, слэш-команды выключены. Каталог прогона - `$G45_WORK/w/<id>/shelfwatch` вне репозитория;
раннер отказывается стартовать, если на пути есть `CLAUDE.md` или есть `~/.claude/CLAUDE.md`.

Окружения Python у исполнителя нет (в промпте сказано прямо): код не запускается, ни `pytest`, ни `ruff`, ни
`mypy`. Это замысел кейсов: все единицы судятся на уровне кода. Единица, чей вердикт держится на поведении,
видном только при запуске (GPU, дедлок, время, сходимость), судится по тому, что исполнитель назвал в коде и
какое последствие указал; величина эффекта не мерится - строка протокола об этом пишет прямо. Версии библиотек
сверялись отдельно, на установленном окружении 3.12 с теми же закреплёнными версиями (`uv pip install` из
`uv pip compile pyproject.toml`; раздел протокола каждого скилла).

Секреты в кейсах - только `FAKE-test-only-not-a-key`.

## Кейсы

Ревью: ветка `feature/<имя>` против `main`, находки - `REVIEW.md`, по строке на находку, severity
blocker/major/minor. Код: поручение `docs/tasks/<N>.md`, выход - `DIFF.patch`, коммитить нельзя.

| Кейс | Ветка | Что | Скиллы |
|---|---|---|---|
| RV-PT | `torch-train` | ревью: цикл обучения ResNet-18, чекпоинт, планировщик, экспорт | python-pytorch |
| RV-DDP | `torch-ddp` | ревью: DDP, смешанная точность, оценка на rank 0 | python-pytorch, python-ml-optimization (дубль, шаг 0) |
| RV-TF | `keras-train` | ревью: Keras, tf.data, сохранение, смешанная точность | python-tensorflow |
| RV-ML | `churn-baseline` | ревью: бейзлайн оттока, утечки, метрика, XGBoost | python-classical-ml |
| RV-CV | `shelf-vision` | ревью: преобразования, дообучение, детекция, сегментация | python-computer-vision |
| RV-NLP | `review-sentiment` | ревью: BERT, NER, QLoRA, инференс | python-nlp-transformers |
| RV-OPT | `optuna-tune` | ревью: Optuna, сетка, профилировщик, `torch.compile` | python-ml-optimization |
| RV-HYG | `tooling-pr` | ревью: настройки ruff, mypy, pytest и CI | python-project-hygiene |
| N0 | `clean-diff` | ревью чистого MR (ML-код написан верно): верно - ничего по предметам скиллов | все семь |
| K-HYG | `quality-gates` | код: SW-260, настроить ruff, mypy, pytest и джобы CI | python-project-hygiene |
| K-NLP | `task-sentiment` | код: SW-261, дообучение BERT, `classify`, адаптер для сводчика | python-nlp-transformers |
| K-ML | `task-churn` | код: SW-262, модель оттока и `predict_next_month` | python-classical-ml |
| N0K | `task-metrics` | код: SW-263, две функции метрик; верно - ничего по предметам скиллов | все семь |

## Ключ

Записан до первого прогона. Единица засчитана, если в `REVIEW.md` (или в коде `DIFF.patch`) есть
находка, которая (а) указывает место - файл и функцию или строку, (б) называет, что неверно, (в) называет
последствие. Слова без места («проверьте DataLoader») не засчитываются. Серьёзность единицы не судится, кроме
приманок. Находка по месту, названному верно, но с последствием, которого здесь нет, не засчитывается.

**Пограничные случаи (правило до прогонов).** Одна находка, которая называет несколько единиц разом (например,
«предобработка до разбиения»), засчитывается каждой единице, чьё место и признак в ней названы; общая фраза без
перечисления - только тем, на чьё место она указывает явно. Находка по двойнику одной и той же строки
засчитывается один раз. Исправление, которое исполнитель предлагает вместо описания дефекта, засчитывается,
если из него дефект выводится.

**Приманка** - место, где код верен или решение допустимо. Находка по приманке с severity blocker или major -
провал по приманке; minor - записывается, не провал. «Дефект вне скилла» - засеян для проверки охвата: находка
по нему со скиллом не должна пропасть относительно контроля.

### RV-PT (`torch_train.py`)

| Код | Единица | Место |
|---|---|---|
| T1 | `evaluate` без `model.eval()`: после `train_epoch` модель остаётся в режиме train | `evaluate` |
| T2 | в `train_epoch` нет `optimizer.zero_grad()`: градиенты копятся | `train_epoch` |
| T3 | `predict` без `no_grad`/`inference_mode` (при `eval()`) | `predict` |
| T4 | `loss.item()` на каждом батче | `train_epoch` |
| T5 | возобновление грузит только веса: оптимизатор, планировщик, номер эпохи потеряны | `load_checkpoint`, `fit` |
| T6 | `torch.save(model, path)` целого объекта | `export` |
| T7 | `OneCycleLR` шагает раз в эпоху вместо раза в батч | `fit` |
| T8 | `ReduceLROnPlateau.step()` без метрики (`TypeError`, проверено на torch 2.14.1) | `fit` |
| T9 | `shuffle=True` вместе с `sampler` (`ValueError` при построении, проверено) | `build_loaders` |

Приманки: PB1 `num_workers=4, pin_memory=True` без `persistent_workers` (пункт скилла «num_workers без
persistent_workers»); PB2 `torch.load(weights_only=True)`; PB3 взвешенный сэмплер против дисбаланса классов.
Вне скилла: X1 токен-литерал `UPLOAD_TOKEN` в коде; X2 `except Exception: pass` вокруг загрузки модели.

### RV-DDP (`ddp_train.py`)

| Код | Единица | Место | Дом |
|---|---|---|---|
| D1 | `DistributedSampler` без `sampler.set_epoch(epoch)` | `worker` | pytorch |
| D2 | `BASE_LR` подобран для батча 32 на одной GPU, эффективный батч растёт в N раз, LR не масштабирован (и нет прогрева) | `worker` | ml-optimization |
| D3 | `scaler.scale(loss).backward()` внутри `autocast` | `worker` | pytorch |
| D4 | чекпоинт `model.state_dict()` у обёрнутой DDP модели: ключи `module.` | `worker` | pytorch |
| D5 | оценка только на rank 0 через обёрнутую DDP модель: forward синхронизирует буферы, остальные ранги уходят в `backward` - зависание | `worker` | pytorch |
| D6 | `refine`: загрузчик без `DistributedSampler`, каждый ранг гоняет весь `shelf/hard` | `refine` | ml-optimization |
| D7 | `print` и `torch.save` на всех рангах (дублирование логов, N записей в один файл) | `worker` | ml-optimization |

Приманки: DB1 `estimate_class_prior` читает весь train на каждом ранге (нужна глобальная доля классов);
DB2 финальный `model.module.state_dict()` на rank 0 после `barrier`. Вне скилла: X1 `MASTER_ADDR` IP-литерал;
X2 `weight=1.0/prior` делит на ноль, если класса нет.

### RV-TF (`keras_train.py`)

| Код | Единица | Место |
|---|---|---|
| F2 | `from_logits=True` при `softmax` в выходном слое | `build_model`, `train` |
| F3 | `EarlyStopping` без `restore_best_weights` | `train` |
| F4 | `monitor="val_loss"` без `validation_data` в `fit` | `train` |
| F5 | `.batch(...).shuffle(...)`: перемешиваются батчи | `make_dataset` |
| F6 | `shuffle(buffer_size=16)` на 120 000 строк для «случайной» выборки | `probe_sample` |
| F7 | `.map(augment)` без `num_parallel_calls` | `train` |
| F8 | нет `prefetch` у обучающего набора | `make_dataset` |
| F9 | `model.save(...h5)` | `train` |
| F10 | `ResidualBlock` без `get_config` | `ResidualBlock` |
| F11 | `SkuNet` (наследник `keras.Model`) без `get_config`, сохраняется целиком | `SkuNet`, `train` |
| F12 | `mixed_float16` и выходной `Dense(softmax)` без `dtype="float32"` | `SkuNet`, начало модуля |
| F14 | модель собрана вне `strategy.scope()` | `train` |
| F15 | `print` и Python-`if len(x)` внутри `@tf.function` | `standardize` |

Приманки: FB1 `model(batch)` без `training=` (в Keras вне `fit` режим инференса по умолчанию); FB2 нет ручной
`LossScaleOptimizer` (`compile` при `mixed_float16` оборачивает сам, проверено на keras 3.15.1: `LossScaleOptimizer`).
Вне скилла: X1 абсолютный путь `/home/dmitry/...`; X2 `assert` как проверка входных данных; X3 `compile` дважды.

### RV-ML (`baseline.py`)

| Код | Единица | Место |
|---|---|---|
| C1 | `StandardScaler.fit_transform` по всем данным до разбиения | `features` |
| C2 | `SMOTE.fit_resample` до `cross_val_score` | `cv_with_smote` |
| C3 | `SelectKBest.fit` по всем данным до разбиения | `features` |
| C4 | `TargetEncoder.fit_transform` по всем данным до разбиения | `features` |
| C5 | `train_test_split` перемешивает месячные срезы | `split_and_fit` |
| C7 | `KFold(shuffle=True)` на упорядоченных по времени срезах | `cv_with_smote` |
| C8 | `accuracy_score` при 5% положительных | `split_and_fit` |
| C9 | `RandomForestClassifier` без `class_weight` при 5% | `split_and_fit` |
| C10 | `n_estimators=10000` и `eval_set` без `early_stopping_rounds` | `fit_xgb` |
| C11 | `max_depth=20` при `learning_rate=0.3` | `fit_xgb` |
| C12 | `OneHotEncoder(sparse_output=False)` на около 1 200 магазинов | `one_hot_stores` |
| C14 | `dropna()` при 18% пропусков в `n_tickets`, пропуск информативен | `load` |

Приманки: CB1 `sku_cv`: `cross_val_score(cv=5)` у классификатора - стратифицированные фолды по умолчанию
(проверено на scikit-learn 1.9.1: `StratifiedKFold`); CB2 `StandardScaler` перед лесом в `scaled_forest`
(лишний, но безвреден); CB3 сетка 2x2 в `tune_forest`. Вне скилла: X1 `print(df.head())`; X2 импорт внутри функции.

### RV-CV (`vision_data.py`, `detect.py`, `segment.py`)

| Код | Единица | Место |
|---|---|---|
| V1 | `cv2.imread` (BGR) без `COLOR_BGR2RGB`, дальше нормализация ImageNet | `ShelfDataset.__getitem__` |
| V2 | предобученный ResNet-50 получает `ToTensor` без нормализации | `embed_shelf` |
| V3 | `Resize(224)` на кадрах 640x480: 298x224, не квадрат | `train_tf` |
| V4 | проверочная выборка получает `train_tf` с аугментациями | `loaders` |
| V5 | `RandomVerticalFlip`, `RandomRotation(180)` на фото полок | `train_tf` |
| V6 | `A.Compose` без `bbox_params`, рамки возвращаются прежними | `augmented` |
| V7 | `AdamW(lr=1e-3)` на всех весах предобученной сети | `fit_classifier` |
| V8 | сеть не заморожена на 600 снимках: полное дообучение сразу | `fit_classifier` |
| V9 | `nms(iou_threshold=0.9)` | `postprocess` |
| V10 | метки YOLO в пикселях, не нормированные | `write_yolo_label` |
| V11 | AP при одном пороге уверенности | `average_precision` |
| V12 | `CrossEntropyLoss` без Dice при 3% положительных пикселей | `criterion` в `segment.py` |
| V13 | тест кормит U-Net 4 уровня входом 100x100 | `test_segment.py` |

Приманки: VB1 `build_detector`: частичная заморозка и разные LR - верно; VB2 `merge_tiles` NMS 0.5;
VB3 `RandomHorizontalFlip`, `ColorJitter` на обучении; VB4 `embed_shelf` конвертирует BGR в RGB.
Вне скилла: X1 `os.system(f"cp {path} ...")`; X2 `embed_shelf` собирает ResNet заново при каждом вызове.

### RV-NLP (`finetune.py`)

| Код | Единица | Место |
|---|---|---|
| N1 | токенизация отзывов по одному в цикле | `tokenize_reviews` |
| N2 | `max_length=256` без `truncation=True` | `tokenize_reviews` |
| N3 | `padding="max_length"` на инференсе | `classify_batch` |
| N4 | токенайзер с добавленными токенами не сохранён; сервис грузит базовый | `train_sentiment`, `classify_batch` |
| N5 | `learning_rate=1e-3` для BERT (NER) | `train_ner` |
| N6 | обучение тональности без прогрева | `train_sentiment` |
| N8 | `base_model` заморожен целиком при задаче «дообучение» | `build_sentiment` |
| N9 | метка слова копируется на каждое подслово | `align_labels`, `encode_for_ner` |
| N10 | `tokenizer(words)` без `is_split_into_words=True` | `encode_for_ner` |
| N11 | `LoraConfig(r=4, target_modules=["q_proj"])` | `build_summarizer` |
| N12 | `BitsAndBytesConfig(load_in_4bit=True)`: вычисления в float32 (проверено на transformers 5.20.1: `torch.float32`, квантизация `fp4`) | `build_summarizer` |
| N13 | сводчик сохраняется адаптером, сервис без `peft` | `export_summarizer` |
| N14 | сводки по одному отзыву | `summarize` |
| N15 | модель на CPU в float32 при p95 50 мс | `load_for_serving` |
| N16 | жадное `generate(max_length=1000, do_sample=False)` | `summarize` |

Приманки: NB1 `num_train_epochs=20` при `eval_strategy="epoch"` и `load_best_model_at_end=True`; NB2 `warmup_steps=0.1`
в NER (в 5.20.1 поля `warmup_ratio` нет, `warmup_steps` принимает долю). Вне скилла: X1 `HF_TOKEN` литерал;
X2 `classify_batch` грузит модель и токенайзер на каждый вызов.

Добавлено по ревью PR #370 (2026-10-20), до прогонов набора `r` (редакция `r1`, пункт N15 с фактом о deprecated): **N15v** -
в закреплённом torch 2.14.1 `quantize_dynamic` (и через `torch.quantization`, и через `torch.ao.quantization`) выдаёт
`DeprecationWarning` («torch.ao.quantization is deprecated ... migrate to use torchao eager mode quantize_ API instead»,
`torch/ao/quantization/utils.py`; проверено на установленном окружении с `-W error`), `torchao` в зависимостях проекта нет.
Засчитывается, если ни в REVIEW.md (RV-NLP), ни в DIFF.patch (K-NLP) нет рекомендации или вызова `quantize_dynamic` без
оговорки о deprecated рядом; иной int8-путь или оговорка - засчитывается. Единица N15 (находка «float32 на CPU при бюджете p95»)
считается как прежде и в K-NLP неприменима. Набор `r`: RV-NLP и K-NLP, по 2 прогона, редакция `r1`; N0, N0K - по 1 прогону
на итоговых редакциях всех семи. Критерий «не хуже контроля» - как в группе: N1, N6, N16 и сохранённые единицы 2/2, приманки не подняты.

Добавлено по повторному ревью PR #370 (раунд 3, 2026-10-21), до прогонов набора `s` (редакция `r2` пункта N15: «динамическое int8-квантование `nn.Linear` (веса и активации)», файл `python-nlp-transformers/inputs/SKILL-r2.md`): **N15w** - ужесточение N15v, правило 11 не задевает. В `r1` пункт назвал «квантование весов», и оба K-NLP-прогона (`k-nlp-r1`: собственный `Int8Linear`, `k-nlp-r2`: `torchao` `Int8WeightOnlyConfig`) дали weight-only - вес разжимается во float на каждом вызове, выигрыша в задержке нет; N15v засчитал их как «иной int8-путь». Новое.
RV-NLP (находка N15 и N15v): засчитывается, если рекомендация квантования называет int8 с квантованием активаций (динамическое: `quantize_dynamic` с оговоркой о deprecated, `torchao` `Int8DynamicActivationInt8WeightConfig` и т. п.); совет «только веса» (weight-only: `Int8WeightOnlyConfig`, собственная замена весов) не засчитывается. K-NLP: SW-261 бюджета задержки не задаёт («на CPU без интернета»), поэтому единица N15 в кейсе по-прежнему n/a, а квантование модели тональности в диффе - дефект вне скилла **X3**; «не хуже контроля» для X3 = не квантует (контроль `c1`-`c4` и редакции `n1`, `n2` - 0/6, редакции `m1`, `m2`, `r1`, `r2` - 4/4 квантуют). Если K-NLP со скиллом `r2` снова квантует - условие «при заданном бюджете» не работает, разбор причины в протокол группы. Набор `s`: RV-NLP и K-NLP, по 2 прогона, редакция `r2`; раннер и флаги те же.

Добавлено по решению владельца (раунд 3, 2026-10-21), до прогонов набора `t` (редакция `r3` пункта N15, файл `python-nlp-transformers/inputs/SKILL-r3.md`): в наборе `s` K-NLP `s2` квантовал модель тональности (1/3 против 0/4 у контроля), слово «CPU» в задаче запустило пункт без заданного бюджета. Условие сужено: пункт применяется только при явно заданном в задаче числовом бюджете задержки (мс или RPS) на CPU, иначе квантование не предлагается и не применяется (формулировка с веткой «иначе ->»). Ключи N15w и X3 не меняются. Набор `t`: RV-NLP и K-NLP, по 3 прогона, редакция `r3`, раннер и флаги те же. Критерий «не хуже контроля»: K-NLP не квантует модель тональности 3/3 (контроль 0/4), RV-NLP N15 (с N15w) 3/3. Если K-NLP хоть раз снова квантует - пункт N15 удаляется из тела скилла, единица остаётся непокрытой названием в «Открыто» с причиной. NB1: ключ не меняется, приманка поднята 9/9 (в major-находке N6), записывается как буквальный провал по ключу с разбором причины в протоколе группы.

Добавлено по ревью PR #370 (раунд 4, 2026-10-21), до прогонов набора `u`: в итоговой редакции `r3` единица N9 найдена 2/3 (`rv-nlp-t3` не нашёл), контроль `c1`, `c2` 2/2; критерий группы - «N1, N6, N16 и сохранённые единицы 2/2». Счёт N9 по ключу (находка называет, что метка слова копируется на подслова, в `align_labels` или `encode_for_ner`; severity не требуется; находка «`align_labels` дублирует `encode_for_ner`» без слов о метках не засчитывается) сверен по выходам: найден в `c1`, `c2`, `t1`, `t2`; не найден в `m1`, `s1`, `t3`. Ключ N9 не меняется. Добор до равного n: RV-NLP без скилла `c3`, `c4` (контроль n=4) и на `r3` `t4` (n=4: `t1`-`t4`); раннер, флаги, редакция `r3` те же. Правило: N9(`r3`, `t1`-`t4`) не ниже N9(контроль, `c1`-`c4`) по числу найденных из четырёх - «не хуже контроля», единица остаётся снятой. Ниже - единица не сохраняется: N9 возвращается названием пунктом в тело (редакция `r4`), правило набора `v` (RV-NLP и K-NLP по 2 прогона на `r4`, критерий группы без изменений плюс N9 2/2 и X3 0/2) записывается отдельным коммитом до его прогонов. `t5` не запускается: выбор числа прогонов не зависит от исхода. Расход набора - в протоколе группы.

Добавлено по ревью PR #370 (раунд 4, 2026-10-21), до прогонов набора `v`. Итог набора `u` (добор по правилу выше): N9 на `r3` `t1`-`t4` 3/4 (`t3` не нашёл), контроль `c1`-`c4` 4/4 (`c3`: 3 находки о метках подслов, `c4`: major) - по правилу выше ниже контроля, единица не сохранена. Редакция `r4` (файл `python-nlp-transformers/inputs/SKILL-r4.md`) - `r3` плюс пункт-название «Метка слова копируется на каждое подслово в разметке токенов (NER)» (ступень 1 лестницы формы; факт и решение не пишутся), `description` не меняется. Ключи не меняются. Набор `v`: RV-NLP и K-NLP, по 2 прогона (`v1`, `v2`) на `r4`, раннер и флаги те же. Критерий: RV-NLP - N9 2/2 (контроль 4/4) и N1, N6, N15 (с N15w), N16 и сохранённые единицы 2/2, NB1 записывается по ключу как прежде; K-NLP - X3 не квантует 2/2, N6v 2/2. Если N9 в `v` ниже 2/2 - пункт-название не восстанавливает единицу, это записывается как «критерий не выполнен», решение остаётся за владельцем эпика (число прогонов не добирается по исходу).

### RV-OPT (`tune.py`)

| Код | Единица | Место |
|---|---|---|
| O1 | `GridSearchCV` по шести параметрам: 729 комбинаций на 3 фолда | `tune_xgb` |
| O2 | 50 эпох без `trial.report` и `trial.should_prune` | `objective` |
| O3 | `lr` без `log=True` | `objective` |
| O4 | `hidden_dim` целым 10..1000 | `objective` |
| O5 | цель - `train_acc`, `val` не используется | `objective` |
| O9 | профиль 100 эпох | `profile_training` |
| O10 | «GPU загружена на 99%, значит узких мест нет» | docstring `profile_training` |
| O11 | компилируют модель, хотя 60% шага в `DataLoader` (`num_workers=0`) | `compile_for_training`, `make_loader` |
| O12 | накопление по 4 шага без деления потерь | `run_epoch` |
| O13 | `torch.compile` модели с ветвлением по данным | `RoutedNet`, `compile_router` |
| O14 | `max-autotune` для коротких пакетных прогонов | `compile_for_inference` |

Приманки: OB1 `weight_decay` с `log=True`, `batch_size` категориями; OB2 `@torch.no_grad()` и `eval()` в `accuracy`.
Вне скилла: X1 `except Exception: return 1.0` (сбой выглядит лучшим результатом при `maximize`); X2 SQLite по
абсолютному домашнему пути.

### RV-HYG (`pyproject.toml`, `pytest.ini`, `.gitlab-ci.yml`, `legacy_features.py`)

| Код | Единица | Место |
|---|---|---|
| H2 | `W` в `select` при `indent-style = "tab"`: W191 против форматтера | `pyproject.toml` |
| H3 | mypy без `check_untyped_defs`: `total + " руб."` в нетипизированной функции не видно | `[tool.mypy]`, `legacy_features.py` |
| H4 | `ignore_missing_imports = true` глобально | `[tool.mypy]` |
| H5 | `mypy src` в CI перекрывает `files`: тесты вне проверки | `.gitlab-ci.yml` |
| H6 | `pytest.ini` рядом с `[tool.pytest.ini_options]`: pyproject не читается, `addopts` с `--cov` не действует | `pytest.ini` |
| H7 | `pytest .` перекрывает `testpaths` | `.gitlab-ci.yml` |
| H8 | нет `--strict-markers`; `@pytest.mark.slwo` проходит | `tests/test_legacy_features.py` |
| H9 | `--cov` без `--cov-fail-under` | `pyproject.toml` |
| H10 | предупреждения не эскалируются (`filterwarnings`) | `pyproject.toml`, `pytest.ini` |
| H11 | в CI нет аудита зависимостей | `.gitlab-ci.yml` |

Приманки: HB1 `line-length = 100`, `target-version`; HB2 `markers` объявлены; HB3 `ignore = ["D100", "D104"]`.
Вне скилла: X1 `PYPI_TOKEN` литерал в CI; X2 `pip install -U ruff mypy pytest` без версий при закреплённых dev;
X3 `ruff format .` пишет файлы в CI вместо `--check`.

### N0 (`clean_train.py`)

Верно написано всё по предметам скиллов: `zero_grad`, `eval`, `no_grad`, планировщик по батчам, полный чекпоинт,
`loss.detach()` без синхронизации, `Pipeline` с импьютером, `class_weight`, `TimeSeriesSplit`, `average_precision`.
Верный исход - ни одной находки по этим предметам. Находка major/blocker по ним - провал; minor - записывается.

### K-HYG (`quality-gates`, выход - `pyproject.toml`, `.gitlab-ci.yml`, описание MR)

| Код | Единица, засчитывается в DIFF.patch |
|---|---|
| H1 | `[tool.ruff.lint] select` расширен сверх дефолта (минимум одна из `I`, `B`, `UP`, `SIM`) |
| H2 | в `select` нет правил, спорящих с форматтером (W191, E111, E114, E117, D206, D300, Q000-Q004, COM812, ISC001), либо они в `ignore` |
| H3 | `check_untyped_defs = true` или `strict = true` |
| H4 | нет глобального `ignore_missing_imports`; допустимы `[[tool.mypy.overrides]]` |
| H5 | `files` в конфиге и в CI `mypy` без путей, либо пути перечисляют и `src`, и `tests` |
| H6 | один конфиг pytest: нет `pytest.ini`, `tox.ini`, `setup.cfg` с секцией pytest |
| H7 | CI зовёт `pytest` без пути, либо путь равен `tests`, `testpaths` задан |
| H8 | `--strict-markers` в `addopts` |
| H9 | если `--cov` есть - `--cov-fail-under`; без покрытия - n/a |
| H10 | `filterwarnings` с `error` |
| H11 | в CI шаг аудита зависимостей (`pip-audit` или `uv audit`), валящий джоб |

### K-NLP (`task-sentiment`, выход - `sentiment_train.py`, тесты)

| Код | Единица |
|---|---|
| N1 | токенизация пачкой одним вызовом (при `Dataset.map(batched=True)` или списком), не в цикле по одному |
| N2 | `truncation=True` при `max_length` (тексты до 600 токенов) |
| N3 | на инференсе динамическое `padding=True`, не `max_length` |
| N4 | токенайзер сохраняется в тот же каталог, что модель (`artifacts/sentiment/`), и `classify` грузит оттуда |
| N5 | `learning_rate` не выше 1e-4 |
| N6 | прогрев (`warmup_steps` или график с прогревом) |
| N7 | эпох не больше 5 либо ранняя остановка с `load_best_model_at_end` |
| N8 | `requires_grad` не отключён у всего `base_model` |
| N11 | `target_modules` шире одного `q_proj` (при Qwen: минимум `q_proj` и `v_proj`) |
| N12 | `bnb_4bit_compute_dtype` задан (float16/bfloat16) |
| N13 | перед отдачей сервису адаптер сливается (`merge_and_unload`), сохраняется модель без зависимости от `peft` |
| N14 | `classify` и `summarize` обрабатывают пачку, не по одному |
| N16 | `summarize` не жадное без ограничения повторов: задан `max_new_tokens` и `num_beams > 1`, либо `repetition_penalty`/`no_repeat_ngram_size`, либо сэмплирование |

N9, N10, N15 в кейсе неприменимы (n/a).

Добавлено после первой пары контроля (`c1`, `c2`), до пары `c3`, `c4`: **N6v** - в `TrainingArguments` нет поля
`warmup_ratio` (transformers 5.20.1, проверено: полей `warmup_ratio` нет, `warmup_steps` принимает целое число
шагов или долю из [0, 1)). Засчитывается, если ни в одном `TrainingArguments` диффа нет `warmup_ratio`. Контроль
`c1`, `c2` по N6v в счёт не идёт: ключ его не содержал, оба прогона написали `warmup_ratio` и попали бы под
провал; они лежат в `runs/` как свидетельство, счёт N6v - по паре `c3`, `c4`.

### K-ML (`task-churn`, выход - `churn_model.py`, тесты)

| Код | Единица |
|---|---|
| C1 | масштабирование и импьютер внутри `Pipeline`/`ColumnTransformer`, `fit` только на обучающей части |
| C4 | кодирование `store_id` не обучается на всех данных до разбиения (внутри `Pipeline` либо вообще нет) |
| C5, C7 | отложенная выборка и кросс-валидация упорядочены по `snapshot` (`TimeSeriesSplit` либо последние месяцы) |
| C8 | метрика отчёта не `accuracy` (PR-AUC, ROC-AUC с оговоркой, F1 по положительному, recall@k) |
| C9 | дисбаланс учтён (`class_weight`, `scale_pos_weight`, SMOTE только внутри `imblearn.Pipeline`) |
| C10 | у XGBoost задана ранняя остановка по отложенной выборке (во времени после обучающей) |
| C11 | нет сочетания `max_depth >= 15` и `learning_rate >= 0.3` |
| C12 | `store_id` не кодируется плотным one-hot |
| C14 | пропуски `n_tickets` импутируются (или признак-индикатор), строки не выбрасываются |

C2, C3 засчитываются, если SMOTE или отбор признаков в решении есть: вне `Pipeline` - провал, иначе n/a.

### N0K (`task-metrics`, выход - `DIFF.patch`)

Верно: изменены `src/shelfwatch/metrics.py` и `tests/test_metrics.py`, новых зависимостей нет, `sklearn`,
`torch` и прочие библиотеки из `pyproject.toml` не импортируются. Иное - провал (вред скилла на задаче вне предмета).

## Счёт и порядок

Контроль - два прогона на кейс без скилла (`c1`, `c2`); единица снимается при 2/2 в каждом кейсе, где она
применима. По итогам шаг 0 (дубли) и ступени формы; прогоны со скиллом на итоговой редакции - на всех кейсах
скилла, N0, N0K и вне-скилльных дефектах. Расход всей группы - потолок $30 по `total_cost_usd`.

## Пересмотр по существу: H2, C9, C10 (стек на #370)

Ключ выше после прогонов не правится. Для трёх единиц, где контроль K-кейса провален по букве ключа, но решение исполнителя допустимо по существу (вопрос владельца в «Открыто» протоколов), ведутся две отметки: **«по ключу»** - как записано выше, неизменно; **«по существу»** - попал ли исполнитель в дефект, ради которого единица записана. Правило записано до пересчёта и до добора прогонов.

| Код | Дефект по существу | Допустимо (не провал) | Провал по существу |
|---|---|---|---|
| H2 | в действующем конфиге ruff есть правило, которое форматтер переписывает или с которым спорит: W191 и D206 при `[tool.ruff.format] indent-style = "tab"`; Q000 и Q003 при `inline-quotes`, расходящемся с `format.quote-style`; Q001, Q002 при `multiline-quotes`/`docstring-quotes = "single"`; COM812 - всегда; ISC002 при `allow-multiline = false` без ISC001 (`ruff 0.17.1 format --check`, проверено 21.10.2026; D300 и ISC001 в проверенных конфигурациях молчат) | `W` (и `E`) в `select` без `indent-style = "tab"`: W191 молчит на пробельном отступе, `ruff format` предупреждения не даёт (проверено на ruff 0.17.1, 20.10.2026) | в `select` правило из списка выше и оно действует (для W191 - табы включены), без `ignore` |
| C9 | редкий класс (около 5%) в обучении модели, и ни веса/пересэмплинг, ни явное решение в коде или описании | веса классов; либо явное решение не взвешивать с основанием, привязанным к метрике и выходу модели (ранжирующая метрика PR-AUC/ROC-AUC, вероятности остаются вероятностями) | неявное «ничего»: ни весов, ни слова об этом. В ревью: находка засчитывается, если называет модель без учёта дисбаланса (веса, пересэмплинг, порог); находка только про метрику - не C9 |
| C10 | XGBoost, где число деревьев не ограничено остановкой по отложенной выборке и заведомо избыточно (тысячи деревьев; `eval_set` задан, а остановки нет) | конечное умеренное число деревьев (порядка сотен) при `learning_rate` не выше 0.1 и глубине не выше 6, выбор модели по отложенной выборке, а не по обучающей; либо ранняя остановка | тысячи деревьев без остановки; отбор по обучающей выборке |

**Счёт.** Единица, судимая по существу, снимается, если контроль верен по существу во всех прогонах каждого применимого кейса. Пересчёт идёт по уже снятым выходам `c1`, `c2` (новых прогонов не требует, если выход однозначно подходит под строку «допустимо» или «провал»). Где данных не хватает (ревью RV-ML для C9: у `c1`, `c2` по существу не поднята ни находка, ни обоснование; K-ML по C9 и C10 - один прогон с весами и один без), прогонов добирают до **n=4** контроля на кейс (`c3`, `c4`): единица снимается при 4/4 по существу, любое расхождение (3/4 и ниже) оставляет её. Расход добора - в протоколах.

**Дополнение после ревью #379 (до добора прогонов).** Для H2 в K-HYG строка «допустимо» записана по конфигурации `c1`, `c2` (`W` без `indent-style = "tab"`), поэтому `c1`, `c2` не свидетельство снятия: пересчёт по ним возвращён в статус «добор». Контроль K-HYG добирается до n=4 (`k-hyg-c3`, `k-hyg-c4`, тот же раннер, `claude-sonnet-5-5` effort medium, без скилла); H2 снимается при 4/4 по строке «допустимо»/«провал» выше, любое расхождение оставляет пункт. RV-HYG остаётся 2/2 по ключу (ключ RV содержит `indent-style = "tab"`, находка поднята обоими). Ключ не правится; строка H2 таблицы выше правилась однажды, после добора: список правил в столбце «Дефект по существу» уточнён коммитом `29d5af08` по пробам `ruff 0.17.1 format --check`, на счёт не влияет - в выходах `c1`-`c4` нет D/Q/COM/ISC и `indent-style = "tab"`. До добора: пункт H2 в `SKILL.md` python-project-hygiene возвращён (1.1.0 как пункт-название).

**Исход.** Единицы, снятые контролем по существу, убираются из `SKILL.md`, протокола, `description`; остальные остаются, вердикт и счёт записаны в протоколе.
