---
name: nlp-transformers
description: NLP Transformers — ловушки tokenization, fine-tuning, LoRA, inference. Активируется при huggingface, transformers, bert, gpt, tokenizer, fine-tune, lora
allowed-tools: Read, Grep, Glob
---

# NLP Transformers — ловушки

## Tokenizer

### Tokenization по одному вместо batch
Плохо: `for text in texts: tokenizer(text)` — 10-100x медленнее
Правильно: `tokenizer(texts, padding=True, truncation=True, return_tensors="pt")`
Почему: batch tokenization использует Rust backend (fast tokenizer). По одному — Python loop overhead

### max_length без truncation=True
Плохо: `tokenizer(text, max_length=512)` — текст > 512 токенов → ошибка или тихий обрез
Правильно: `tokenizer(text, max_length=512, truncation=True, padding='max_length')`
Почему: без explicit `truncation=True` поведение зависит от версии transformers — непредсказуемо

### padding='max_length' для inference
Плохо: `padding='max_length'` на inference → все тексты паддятся до 512 даже если они по 20 токенов
Правильно: `padding=True` (dynamic) для inference, `padding='max_length'` только для training
Почему: padding до max_length на inference = wasted compute. 20 токенов обрабатываются как 512

### Tokenizer не сохранён с моделью
Плохо: fine-tune модель → `model.save_pretrained()` → загрузка с `AutoTokenizer.from_pretrained("bert-base")`
Правильно: всегда `tokenizer.save_pretrained()` + `model.save_pretrained()` в одну директорию
Почему: vocab mismatch после fine-tuning с добавленными special tokens → garbage output

## Fine-tuning

### LR от обычного training (1e-3)
Плохо: `learning_rate=1e-3` для BERT fine-tuning → catastrophic forgetting
Правильно: `2e-5 — 5e-5` для encoder models (BERT), `1e-5 — 3e-5` для decoder (GPT)
Почему: pretrained weights деликатные. High LR уничтожает знания за первые steps

### Без warmup
Плохо: training без `warmup_ratio` — первые steps с полным LR ломают pretrained weights
Правильно: `warmup_ratio=0.1` или `warmup_steps=500`
Почему: градиенты на первых батчах нестабильны (random head). Высокий LR + нестабильные градиенты = damage

### Слишком много эпох
Плохо: `num_train_epochs=20` для BERT → overfit после 3-4 эпохи
Правильно: 2-4 эпохи + `eval_strategy='epoch'` + early stopping (`load_best_model_at_end=True`)
Почему: BERT с 110M параметров overfits на маленьких датасетах за 3-4 эпохи. 20 эпох = memorization

### Весь backbone заморожен
Плохо: `for param in model.base_model.parameters(): param.requires_grad = False` — модель не адаптируется
Правильно: заморозить 70-80% нижних слоёв, верхние оставить trainable
Почему: нижние слои = общие features (syntax, morphology), верхние = task-specific. Замораживая всё — используешь только random head

## NER-специфичные

### Subword label alignment
Плохо: `"New York" → ["New", "York"] → [B-LOC, B-LOC]` — "York" должен быть I-LOC
Правильно: first subword → original label, rest → `-100` (ignore) или I-tag
Почему: модель учится что каждый subword = начало entity → precision падает на multi-token entities

### Без is_split_into_words для pre-tokenized
Плохо: `tokenizer(text)` для уже разделённых слов → tokenizer разбивает повторно
Правильно: `tokenizer(words, is_split_into_words=True, truncation=True)`
Почему: слово `"O'Brien"` разобьётся дважды, label alignment полностью сломается

## LoRA / QLoRA

### r=4 и только q_proj
Плохо: `LoraConfig(r=4, target_modules=["q_proj"])` — слишком мало capacity
Правильно: `r=16, target_modules=["q_proj", "v_proj"]` для general, `r=64` + все проекции для complex tasks
Почему: r=4 недостаточно для domain adaptation. Только q_proj — модель не учится attention patterns

### QLoRA без compute dtype
Плохо: `BitsAndBytesConfig(load_in_4bit=True)` — `bnb_4bit_compute_dtype` по умолчанию float32
Правильно: `bnb_4bit_compute_dtype=torch.float16, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True`
Почему: 4-bit storage + float32 compute = медленнее чем float16. Double quant экономит ещё ~0.4 бит/параметр

### LoRA merge забыт перед deployment
Плохо: deploy модель + отдельный LoRA adapter → нужна peft библиотека в inference
Правильно: `model.merge_and_unload()` → сохранить как обычную модель
Почему: без merge — overhead загрузки adapter, dependency на peft, не работает с ONNX/TensorRT

## Inference

### Inference по одному вместо batch
Плохо: `for text in texts: pipeline(text)` — GPU простаивает
Правильно: `pipeline(texts, batch_size=32)` или DataLoader с batch
Почему: GPU эффективен на batch операциях. По одному — 90% времени GPU idle

### Full precision на production
Плохо: inference на float32 — 1.3GB модель, медленно
Правильно: dynamic quantization `torch.quantization.quantize_dynamic(model, {nn.Linear}, torch.qint8)` или ONNX
Почему: quantized модель ~4x меньше, 2-4x faster. Для classification/NER деградация quality < 1%

### Greedy decoding для generation
Плохо: `model.generate(max_length=1000, do_sample=False)` — repetitive output
Правильно: `temperature=0.7, top_p=0.9, do_sample=True` для creative, `num_beams=4` для translation
Почему: greedy = самый вероятный токен каждый раз → loops и repetition

## Чек-лист

- Batched tokenization с padding + truncation
- Fine-tuning LR: 2e-5 — 5e-5, не 1e-3
- Warmup + early stopping + eval каждую эпоху
- Tokenizer сохранён вместе с моделью
- NER: `is_split_into_words=True`, subword label alignment
- LoRA: r=16+ для реальных задач, merge перед deploy
- QLoRA: `bnb_4bit_compute_dtype=float16`
- Inference: batched, quantized для production
