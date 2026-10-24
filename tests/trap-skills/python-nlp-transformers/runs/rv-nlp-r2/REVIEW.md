src/shelfwatch/finetune.py:22 - токен HF захардкожен в коде (сейчас заглушка, но шаблон приведёт к утечке реального токена в историю git); брать из окружения - minor
src/shelfwatch/finetune.py:27 - токенизация по одному тексту в цикле, и без truncation=True max_length игнорируется: медленно, длинные отзывы не обрезаются и ломают батч/модель (>512) - major
src/shelfwatch/finetune.py:35 - заморожен весь base_model, включая эмбеддинги, после добавления [PRODUCT]/[SHOP]: эмбеддинги новых токенов остаются случайными и не обучаются, смысла от спец-токенов нет - major
src/shelfwatch/finetune.py:42 - дообучение на 20 эпох без прогрева (нет warmup_steps): нестабильный старт, переобучение; число эпох избыточно при замороженной базе - major
src/shelfwatch/finetune.py:52 - сохраняется только модель, токенайзер со спец-токенами не сохраняется: при загрузке словарь расходится с эмбеддингами - major
src/shelfwatch/finetune.py:57 - токенайзер грузится из базового BERT без [PRODUCT]/[SHOP]: токены режутся на подслова, предсказания не совпадают с обучением; модель и токенайзер грузятся заново на каждый вызов - major
src/shelfwatch/finetune.py:59 - padding="max_length" до 512 при бюджете p95 50 мс на CPU: всё дополняется до 512 токенов, задержка многократно выше бюджета; нужен динамический padding и короче max_length - major
src/shelfwatch/finetune.py:65 - tokenizer(words) без is_split_into_words=True: слова воспринимаются как пачка текстов, word_ids() без индекса падает/даёт неверное выравнивание, NER не обучится - blocker
src/shelfwatch/finetune.py:66 - метка слова копируется на все подслова, включая B-метки (B-PROD повторяется внутри слова), нет truncation; дублирует align_labels (стр. 70) вместо вызова - minor
src/shelfwatch/finetune.py:80 - learning_rate=1e-3 для полного дообучения BERT в NER: расходимость, веса разрушаются (норма 2e-5..5e-5) - major
src/shelfwatch/finetune.py:89 - QLoRA без bnb_4bit_quant_type="nf4", compute_dtype и prepare_model_for_kbit_training: хуже качество, нестабильное обучение градиентов - minor
src/shelfwatch/finetune.py:91 - LoRA r=4 только на q_proj: слабая ёмкость для сводки, качество будет близко к базовой модели - minor
src/shelfwatch/finetune.py:98 - генерация по одному отзыву в цикле, без батча: низкая пропускная способность - minor
src/shelfwatch/finetune.py:99 - жадное декодирование без repetition_penalty/no_repeat_ngram_size: сводки зацикливаются; max_length=1000 считает и промпт (нужен max_new_tokens) - major
src/shelfwatch/finetune.py:100 - decode всего gen[0] вместе с промптом: в сводку попадает исходный отзыв - major
src/shelfwatch/finetune.py:106 - сохраняется только адаптер, база подтягивается по имени, а в образе сервиса нет peft: сводчик в сервисе не загрузится; нужно слить адаптер (merge_and_unload) и сохранить целую модель - blocker
src/shelfwatch/finetune.py:111 - модель в fp32 на CPU при бюджете p95 50 мс: бюджет не выполнится; нужно int8-квантование весов nn.Linear (не deprecated torch.ao quantize_dynamic в torch 2.14) и проверка p95; токенайзер не загружается, подготовка к экспорту в ONNX отсутствует - major
tests/test_finetune.py:4 - тест только на align_labels; encode_for_ner, токенизация, спец-токены, загрузка для сервиса и задержка не покрыты, ошибку на стр. 65 тест не поймает - minor
