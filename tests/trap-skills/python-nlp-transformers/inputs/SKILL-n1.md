---
name: python-nlp-transformers
description: NLP Transformers - токенизация пачкой, прогрев при дообучении, генерация, инференс на CPU. Активируется при huggingface, transformers, tokenizer, fine-tune, warmup, generate, do_sample, TrainingArguments, quantization, отзывы
---

# NLP Transformers - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Токенизация по одному тексту в цикле
- Дообучение без прогрева
- Генерация жадным декодированием без ограничения повторов
- Модель в полной точности на CPU при заданном бюджете задержки
