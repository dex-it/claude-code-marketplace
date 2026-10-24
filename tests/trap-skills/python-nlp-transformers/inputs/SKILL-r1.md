---
name: python-nlp-transformers
description: NLP Transformers - токенизация пачкой, прогрев при дообучении, генерация, инференс на CPU. Активируется при huggingface, transformers, tokenizer, fine-tune, warmup, generate, do_sample, TrainingArguments, quantization, отзывы
---

# NLP Transformers - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- Токенизация по одному тексту в цикле
- Дообучение без прогрева: с transformers 5.15 прогрев задаёт `warmup_steps` (целое число шагов или доля из [0, 1)), поля `warmup_ratio` в `TrainingArguments` нет
- Генерация жадным декодированием без ограничения повторов
- Модель в полной точности на CPU при заданном бюджете задержки: int8-квантование весов `nn.Linear`; eager-API `torch.ao.quantization` (в том числе `quantize_dynamic`) в torch 2.14 deprecated
