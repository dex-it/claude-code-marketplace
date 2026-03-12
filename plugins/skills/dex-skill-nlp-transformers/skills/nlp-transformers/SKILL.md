---
name: nlp-transformers
description: NLP Transformers — ловушки tokenization, fine-tuning, LoRA, inference. Активируется при huggingface, transformers, bert, gpt, tokenizer, fine-tune, lora
allowed-tools: Read, Grep, Glob
---

# NLP Transformers — ловушки

## Правила

- Batched tokenization, не по одному — 10-100x быстрее
- `padding='max_length'` для training, `padding=True` (dynamic) для inference
- `from_logits` — проверь что на выходе модели (logits vs probabilities)
- LoRA/QLoRA для моделей >1B параметров — full fine-tuning не влезет в GPU

## Tokenizer ловушки

```
Плохо:
  for text in texts:
      encoded = tokenizer(text)  # По одному — медленно!

Хорошо:
  encoded = tokenizer(texts, padding=True, truncation=True, return_tensors="pt")

Плохо:
  tokenizer(text, max_length=512)
  // Без truncation=True: если текст > 512 токенов → ошибка или тихий обрез

Хорошо:
  tokenizer(text, max_length=512, truncation=True, padding='max_length')

Плохо:
  tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
  # Потом fine-tune и сохранил модель без tokenizer
  // При inference: tokenizer не совпадает с моделью (vocab mismatch)

Правило:
  Всегда сохраняй tokenizer вместе с моделью:
  tokenizer.save_pretrained('./my_model')
  model.save_pretrained('./my_model')
```

## Fine-tuning ловушки

| Ошибка | Последствие | Решение |
|--------|-------------|---------|
| `lr=1e-3` для BERT | Catastrophic forgetting — pretrained знания уничтожены | LR 2e-5 — 5e-5 для fine-tuning |
| Без warmup | Первые steps ломают pretrained weights | `warmup_ratio=0.1` в TrainingArguments |
| `num_train_epochs=20` | BERT fine-tune = 2-4 эпохи, больше → overfit | 2-4 эпохи + early stopping |
| `eval_strategy='no'` | Не видишь overfitting до конца обучения | `eval_strategy='epoch'` + early stopping |
| Замороженный весь backbone | Модель не адаптируется к домену | Заморозить 70-80% нижних слоёв, не все |

```
Плохо:
  training_args = TrainingArguments(
      learning_rate=1e-3,      # Слишком высокий!
      num_train_epochs=20,     # Слишком много!
      eval_strategy='no',      # Нет мониторинга!
  )

Хорошо:
  training_args = TrainingArguments(
      learning_rate=2e-5,
      num_train_epochs=3,
      eval_strategy='epoch',
      save_strategy='epoch',
      load_best_model_at_end=True,
      warmup_ratio=0.1,
      weight_decay=0.01,
      fp16=True,
  )
```

## NER-специфичные ловушки

```
Плохо:
  # Subword tokens получают label родительского слова
  "New York" → ["New", "York"] → [B-LOC, B-LOC]
  // "York" должен быть I-LOC, не B-LOC!

Хорошо:
  # First subword → original label, rest → -100 (ignore) или I-tag
  "playing" → ["play", "##ing"] → [B-VERB, -100]

Плохо:
  tokenizer(text, truncation=True)
  // NER: is_split_into_words=True обязателен для pre-tokenized input
  // Без него tokenizer разобьёт уже разделённые слова повторно

Хорошо:
  tokenizer(words, is_split_into_words=True, truncation=True)
```

## LoRA ловушки

```
Плохо:
  LoraConfig(r=4, target_modules=["q_proj"])
  // r=4 слишком мал для complex tasks, только q_proj — недостаточно

Хорошо (general):
  LoraConfig(r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"])

Хорошо (complex tasks):
  LoraConfig(r=64, lora_alpha=16, target_modules=["q_proj", "k_proj", "v_proj", "o_proj"])

Плохо:
  # QLoRA без правильного compute dtype
  BitsAndBytesConfig(load_in_4bit=True)
  // bnb_4bit_compute_dtype по умолчанию float32 — медленно!

Хорошо:
  BitsAndBytesConfig(
      load_in_4bit=True,
      bnb_4bit_quant_type="nf4",
      bnb_4bit_compute_dtype=torch.float16,  # или bfloat16
      bnb_4bit_use_double_quant=True
  )
```

## Inference ловушки

```
Плохо:
  for text in texts:
      result = pipeline(text)  # По одному — GPU простаивает

Хорошо:
  results = pipeline(texts, batch_size=32)  # Batched inference

Плохо:
  model = AutoModel.from_pretrained("bert-large-uncased")
  # Production inference на full precision
  // 1.3GB модель, медленный inference

Хорошо:
  # Quantization для production
  model = torch.quantization.quantize_dynamic(
      model, {torch.nn.Linear}, dtype=torch.qint8
  )
  // ~440MB → ~110MB, 2-4x faster

Плохо:
  outputs = model.generate(max_length=1000, do_sample=False)
  // Greedy decoding — repetitive, boring output

Хорошо:
  outputs = model.generate(
      max_length=1000,
      temperature=0.7, top_p=0.9, do_sample=True
  )
```

## Чек-лист

- [ ] Batched tokenization с padding + truncation
- [ ] Fine-tuning LR: 2e-5 — 5e-5, не 1e-3
- [ ] Warmup + early stopping + eval каждую эпоху
- [ ] Tokenizer сохранён вместе с моделью
- [ ] NER: `is_split_into_words=True`, subword label alignment
- [ ] LoRA: r=16+ для реальных задач, правильные target_modules
- [ ] QLoRA: `bnb_4bit_compute_dtype=float16`
- [ ] Inference: batched, quantized для production
