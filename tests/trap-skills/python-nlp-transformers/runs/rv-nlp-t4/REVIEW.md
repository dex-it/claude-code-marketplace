src/shelfwatch/finetune.py:13 - peft импортируется на уровне модуля, а в образе сервиса разметки peft нет: любой импорт finetune (classify_batch, load_for_serving) падает с ImportError - blocker
src/shelfwatch/finetune.py:28 - токен HF зашит в код и уйдёт в историю git; при замене на настоящий ключ он утечёт, нужно брать из окружения - minor
src/shelfwatch/finetune.py:33 - токенизация по одному тексту в цикле и без truncation=True (max_length молча не действует): медленно, а длинные отзывы дадут ошибку или предупреждение; надо токенизировать пачкой с truncation - major
src/shelfwatch/finetune.py:41 - замораживается весь base_model, включая эмбеддинги, куда добавлены [PRODUCT] и [SHOP]: новые токены остаются случайными и необучаемыми, обучается только голова, смысл спец-токенов теряется - major
src/shelfwatch/finetune.py:48 - дообучение тональности без прогрева (нет warmup_steps) и на 20 эпох: нестабильный старт, переобучение; load_best_model_at_end без metric_for_best_model выбирает по loss - major
src/shelfwatch/finetune.py:58 - сохраняется только модель, токенизатор с добавленными спец-токенами не сохраняется: сервис не восстановит словарь, и id новых токенов разойдутся с обученными - major
src/shelfwatch/finetune.py:63 - classify_batch берёт токенизатор BERT без [PRODUCT]/[SHOP]: они разбиваются на подслова, эмбеддинги новых токенов не используются, качество в проде ниже, чем на валидации - major
src/shelfwatch/finetune.py:64 - токенизатор и модель загружаются с диска при каждом вызове: загрузка занимает секунды, p95 50 мс не достижим - blocker
src/shelfwatch/finetune.py:65 - padding="max_length" до 512 для каждого отзыва на CPU: лишние вычисления кратно больше нужных, бюджет 50 мс будет превышен; нужен динамический паддинг - major
src/shelfwatch/finetune.py:71 - tokenizer(words) без is_split_into_words=True: список слов трактуется как батч, enc.word_ids() без индекса падает с ошибкой, а при обходе метки сдвигаются - major
src/shelfwatch/finetune.py:73 - метка слова копируется на все подслова, у подслов B-* остаётся B-: модель учится видеть несколько начал сущности; плюс дублирует align_labels (стр. 76), кодирование и тест расходятся - minor
src/shelfwatch/finetune.py:86 - learning_rate=1e-3 для полного дообучения BERT: веса разрушаются, NER не сойдётся (норма 2e-5..5e-5) - major
src/shelfwatch/finetune.py:95 - 4-битная загрузка без bnb_4bit_quant_type="nf4", compute dtype и prepare_model_for_kbit_training: QLoRA получится хуже и менее стабильной, чем задумано - minor
src/shelfwatch/finetune.py:97 - LoRA только на q_proj с r=4: ёмкости адаптера мало для сводки, качество будет близко к базовой модели - minor
src/shelfwatch/finetune.py:105 - жадное декодирование без ограничения повторов (нет no_repeat_ngram_size/repetition_penalty): сводки зацикливаются; max_length=1000 считает ещё и промпт, нужен max_new_tokens - major
src/shelfwatch/finetune.py:106 - decode всего gen[0] вместе с промптом: в сводку попадёт исходный отзыв с «Кратко:» - minor
src/shelfwatch/finetune.py:112 - сохраняется только адаптер, база подтягивается по имени, а в образе сервиса нет peft: сводчик на сервисе не загрузить, нужно слить адаптер (merge_and_unload) и сохранить целую модель - blocker
src/shelfwatch/finetune.py:117 - модель в fp32 на CPU при бюджете p95 ≤ 50 мс и без квантования: бюджет задан, значит нужно динамическое int8-квантование nn.Linear (веса и активации); eager torch.ao.quantize_dynamic в torch 2.14 deprecated, брать поддерживаемый путь, согласованный с экспортом в ONNX (int8 в ONNX Runtime) - major
tests/test_finetune.py:6 - тест проверяет только align_labels и первый элемент NER_LABELS; encode_for_ner, токенизация и загрузка не покрыты, поэтому ошибки со стр. 71 и 63 пройдут CI - minor
