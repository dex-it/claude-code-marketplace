src/shelfwatch/finetune.py:35 - весь BERT (включая embeddings) заморожен после resize_token_embeddings, эмбеддинги новых [PRODUCT]/[SHOP] остаются случайными и не обучаются; спец-токены станут шумом, качество тональности упадёт - blocker
src/shelfwatch/finetune.py:52 - сохраняется только модель, токенайзер со спец-токенами не сохраняется; в serving токенайзер берётся из базового BERT, [PRODUCT]/[SHOP] режутся на подслова, вход расходится с обучением, предсказания тихо деградируют - blocker
src/shelfwatch/finetune.py:57 - classify_batch грузит токенайзер из BERT, а не из артефакта обучения (без добавленных токенов) - major
src/shelfwatch/finetune.py:58 - токенайзер и модель загружаются с диска при каждом вызове, сотни мс на запрос; p95 ≤ 50 мс недостижим - blocker
src/shelfwatch/finetune.py:59 - padding="max_length" на 512 токенов для rubert-base на CPU: каждый отзыв считается как максимальной длины, p95 50 мс не выдержать (нужны динамический padding, меньший max_length, ONNX/квантизация); также нет model.eval() - major
src/shelfwatch/finetune.py:65 - tokenizer(words) без is_split_into_words=True: список слов трактуется как батч, enc.word_ids() упадёт/вернёт неверное выравнивание, NER не обучится - blocker
src/shelfwatch/finetune.py:72 - метка слова копируется на все подслова, в т.ч. B-PROD/B-SHOP на продолжениях (должны быть I-* или -100); модель получает ложные начала сущностей, сломаются границы сущностей - major
src/shelfwatch/finetune.py:27 - max_length без truncation=True: усечения нет (только предупреждение), отзывы длиннее 512 токенов упадут в модели; нет и padding/return-формата для Trainer - major
src/shelfwatch/finetune.py:80 - learning_rate=1e-3 для полного дообучения BERT в NER: веса разрушатся, loss разойдётся - major
src/shelfwatch/finetune.py:82 - warmup_steps=0.1 - это 0.1 шага (int), а не доля; прогрева фактически нет (нужен warmup_ratio) - minor
src/shelfwatch/finetune.py:85 - NER Trainer без data collator для токен-классификации (DataCollatorForTokenClassification) и без compute_metrics/seqeval, паддинг меток и качество не контролируются; train_ner не сохраняет модель - major
src/shelfwatch/finetune.py:45 - 20 эпох при замороженной базе и lr 3e-5 для одной головы: долго и недообучено/переобучено, без early stopping и metric_for_best_model; load_best_model_at_end выбирает по eval_loss - minor
src/shelfwatch/finetune.py:22 - токен HF захардкожен в исходниках (помечен как тестовый, но шаблон утекает в коммиты; передавать через окружение) и передаётся в from_pretrained - minor
src/shelfwatch/finetune.py:89 - BitsAndBytesConfig(load_in_4bit=True) без nf4, double quant и bnb_4bit_compute_dtype, и нет prepare_model_for_kbit_training перед get_peft_model: нестабильное/медленное QLoRA-обучение, градиенты по чекпойнтингу не настроены - major
src/shelfwatch/finetune.py:91 - LoRA r=4 только на q_proj: ёмкости мало для сводки, качество будет близко к базовой модели - minor
src/shelfwatch/finetune.py:88 - нет функции/Trainer обучения сводчика: QLoRA-адаптер создаётся, но нигде не обучается, заявленная функциональность отсутствует - major
src/shelfwatch/finetune.py:99 - max_length=1000 включает длину промпта и, без max_new_tokens, сводка может быть обрезана или чрезмерно длинной; генерация по одному отзыву без батча - minor
src/shelfwatch/finetune.py:100 - decode(gen[0]) возвращает промпт вместе со сводкой (не срезан вход), в сводке окажется исходный отзыв - major
src/shelfwatch/finetune.py:106 - сохраняется только адаптер, а сервис без peft и без GPU/bitsandbytes его загрузить не сможет; базовая Qwen тянется по имени (сеть, нет фиксации ревизии) - нужно merge_and_unload в обычную модель - blocker
src/shelfwatch/finetune.py:111 - load_for_serving загружает полный fp32 BERT-base без eval, ONNX-экспорта в коде нет, хотя он нужен для p95 ≤ 50 мс на CPU; только сентимент, NER и сводчик в serving не загружаются - major
tests/test_finetune.py:4 - тест проверяет только align_labels на синтетике и константу; нет тестов encode_for_ner, спец-токенов, serving-пути и латентности, баги выше не ловятся - minor
