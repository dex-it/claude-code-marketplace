src/shelfwatch/finetune.py:7 - модуль на верхнем уровне импортирует peft, bitsandbytes, datasets; в образе сервиса разметки peft нет, поэтому `load_for_serving`/`classify_batch` упадут с ImportError при импорте модуля (то же для tests/test_finetune.py) - blocker
src/shelfwatch/finetune.py:106 - сохраняется только LoRA-адаптер, база подтягивается по имени, 4-бит с bitsandbytes; сервис без peft и на CPU его не загрузит, слияния (merge_and_unload) в полном весе нет, экспорт в ONNX невозможен - blocker
src/shelfwatch/finetune.py:52 - сохраняется только модель, токенизатор с [PRODUCT]/[SHOP] не сохраняется; в сервисе токены не будут распознаваться, а id новых токенов рассинхронизируются с эмбеддингами - major
src/shelfwatch/finetune.py:57 - токенизатор грузится из исходного BERT без добавленных [PRODUCT]/[SHOP]: они разобьются на подслова, обученные эмбеддинги не используются, качество тональности в проде ниже офлайн-метрик - major
src/shelfwatch/finetune.py:57 - модель и токенизатор загружаются с диска при каждом вызове classify_batch; на каждый запрос уходят секунды, p95 50 мс недостижим - major
src/shelfwatch/finetune.py:59 - padding="max_length" до 512 токенов на CPU для BERT-base: сотни мс на отзыв (при обучении было 256), p95 ≤ 50 мс не выполняется, к тому же расхождение длины train/serve; нужны динамический паддинг, меньший max_length, квантизация/дистилляция - major
src/shelfwatch/finetune.py:35 - замораживается весь base_model, включая эмбеддинги; новые токены [PRODUCT]/[SHOP] остаются случайными и не учатся, обучается только голова, при lr 3e-5 она недообучится - major
src/shelfwatch/finetune.py:51 - Trainer без processing_class/data_collator: отзывы разной длины не паддятся, батч 32 упадёт на collate (если train_ds не паддингован заранее); токенизатор не попадает в чекпоинты - major
src/shelfwatch/finetune.py:27 - tokenizer(t, max_length=256) без truncation=True: ограничение не применяется, отзывы до 600 токенов дают вход >512 и ошибку на позиционных эмбеддингах - major
src/shelfwatch/finetune.py:45 - 20 эпох без early stopping и без metric_for_best_model/compute_metrics (macro_f1 есть в metrics.py, но не используется): лучший чекпоинт выбирается по loss, 20 чекпоинтов BERT на диске - minor
src/shelfwatch/finetune.py:65 - tokenizer(words) без is_split_into_words=True: каждое слово токенизируется как отдельный пример, word_ids() даёт неверные индексы или падает, метки NER смещаются - major
src/shelfwatch/finetune.py:66 - метка слова копируется всем подсловам, включая B-PROD/B-SHOP на продолжениях (нужна I- или -100); дублирует align_labels (стр. 70), которая не используется - сущности дробятся, F1 по NER занижен - major
src/shelfwatch/finetune.py:72 - align_labels даёт метку слова каждому подслову, у продолжений остаётся B-; тест проверяет только спецтокены, не подслова - minor
src/shelfwatch/finetune.py:80 - learning_rate=1e-3 при полном дообучении BERT: расходимость и забывание, NER не обучится - major
src/shelfwatch/finetune.py:82 - warmup_steps=0.1 передаётся как число шагов, а не доля (нужен warmup_ratio): прогрева практически нет - minor
src/shelfwatch/finetune.py:85 - train_ner не сохраняет итоговую модель и не задаёт id2label/label2id: обученная NER-модель теряется, предсказания без имён меток - major
src/shelfwatch/finetune.py:88 - для сводки есть только сборка модели, нет обучения QLoRA и данных, хотя в MR заявлено дообучение; в 4-бит нет nf4/compute dtype и prepare_model_for_kbit_training - major
src/shelfwatch/finetune.py:91 - LoRA r=4 только на q_proj для 1.5B-модели: слабая ёмкость, сводки близки к базовой модели - minor
src/shelfwatch/finetune.py:98 - промпт "Кратко: ..." без chat template для Instruct-модели и по одному отзыву в цикле: низкое качество и медленная генерация - minor
src/shelfwatch/finetune.py:99 - max_length=1000 включает промпт (длинные отзывы обрежут или заблокируют генерацию), а decode (стр. 100) возвращает промпт вместе с ответом: в «сводке» дублируется отзыв - major
src/shelfwatch/finetune.py:22 - токен HF захардкожен в коде и передаётся в from_pretrained; шаблон закрепляется и попадёт в историю git, брать из окружения - minor
src/shelfwatch/finetune.py:111 - load_for_serving не вызывает eval(), не грузит токенизатор и ничего не делает для ONNX; docstring говорит про сводчик, а грузится классификатор - minor
tests/test_finetune.py:1 - единственный тест проверяет только align_labels на спецтокенах; токенизацию, подслова NER, serving и латентность не покрывает, а импорт требует peft/bitsandbytes - minor
