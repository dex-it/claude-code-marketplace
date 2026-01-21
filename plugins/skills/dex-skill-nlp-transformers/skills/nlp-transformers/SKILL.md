---
name: nlp-transformers
description: HuggingFace Transformers - tokenizers, fine-tuning BERT/GPT, text classification, NER, LoRA. Активируется при huggingface, transformers, bert, gpt, tokenizer, fine-tune, lora
allowed-tools: Read, Grep, Glob
---

# NLP with Transformers

## Tokenizers

### Правильное использование tokenizers

```python
from transformers import AutoTokenizer
import torch

# Правильно - batched tokenization с padding
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

texts = [
    "Short text",
    "This is a much longer text that will be truncated",
    "Medium length text"
]

# Batched encoding
encoded = tokenizer(
    texts,
    padding=True,  # Pad до max length в batch
    truncation=True,  # Обрезать если больше max_length
    max_length=128,
    return_tensors="pt"  # PyTorch tensors
)

print(encoded.keys())  # dict_keys(['input_ids', 'attention_mask'])
print(encoded['input_ids'].shape)  # [3, 128]

# Decode обратно
decoded = tokenizer.decode(encoded['input_ids'][0], skip_special_tokens=True)

# Неправильно - токенизация по одному
for text in texts:
    encoded = tokenizer(text)  # Медленно! НЕ batched!
```

### Fast Tokenizers

```python
from transformers import AutoTokenizer

# Правильно - использовать fast tokenizers (написаны на Rust)
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased", use_fast=True)

# Fast tokenizers имеют дополнительные features
encoded = tokenizer(
    texts,
    padding=True,
    truncation=True,
    return_offsets_mapping=True,  # Маппинг tokens → original text
    return_special_tokens_mask=True
)

# Offset mapping для извлечения spans
print(encoded['offset_mapping'][0])  # [(0, 5), (6, 10), ...]
```

## Text Classification Fine-tuning

### Using Trainer API

```python
from typing import Dict
import numpy as np
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    EarlyStoppingCallback
)
from datasets import Dataset, DatasetDict
from sklearn.metrics import accuracy_score, f1_score

# Prepare dataset
def create_dataset(texts: list[str], labels: list[int]) -> Dataset:
    """Create HuggingFace Dataset."""
    return Dataset.from_dict({
        'text': texts,
        'label': labels
    })

# Tokenize function
def tokenize_function(examples: Dict, tokenizer: AutoTokenizer) -> Dict:
    """Tokenize batch of examples."""
    return tokenizer(
        examples['text'],
        padding='max_length',
        truncation=True,
        max_length=128
    )

# Правильно - fine-tuning с Trainer
def fine_tune_classifier(
    train_texts: list[str],
    train_labels: list[int],
    val_texts: list[str],
    val_labels: list[int],
    model_name: str = "bert-base-uncased",
    num_labels: int = 2
) -> Trainer:
    """Fine-tune BERT for text classification."""
    # Load model and tokenizer
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=num_labels
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    # Create datasets
    train_dataset = create_dataset(train_texts, train_labels)
    val_dataset = create_dataset(val_texts, val_labels)

    dataset_dict = DatasetDict({
        'train': train_dataset,
        'validation': val_dataset
    })

    # Tokenize
    tokenized_datasets = dataset_dict.map(
        lambda x: tokenize_function(x, tokenizer),
        batched=True,
        remove_columns=['text']
    )

    # Training arguments
    training_args = TrainingArguments(
        output_dir='./results',
        eval_strategy='epoch',
        save_strategy='epoch',
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        num_train_epochs=3,
        weight_decay=0.01,
        load_best_model_at_end=True,
        metric_for_best_model='f1',
        logging_dir='./logs',
        logging_steps=100,
        fp16=True,  # Mixed precision
        dataloader_num_workers=4
    )

    # Metrics function
    def compute_metrics(eval_pred):
        predictions, labels = eval_pred
        predictions = np.argmax(predictions, axis=1)
        return {
            'accuracy': accuracy_score(labels, predictions),
            'f1': f1_score(labels, predictions, average='weighted')
        }

    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets['train'],
        eval_dataset=tokenized_datasets['validation'],
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)]
    )

    # Train
    trainer.train()

    return trainer
```

## Named Entity Recognition (NER)

```python
from transformers import AutoModelForTokenClassification, pipeline

# Fine-tune для NER
def fine_tune_ner(
    train_texts: list[str],
    train_labels: list[list[str]],  # ["O", "B-PER", "I-PER", ...]
    label2id: Dict[str, int]
) -> Trainer:
    """Fine-tune for NER."""
    model = AutoModelForTokenClassification.from_pretrained(
        "bert-base-uncased",
        num_labels=len(label2id),
        id2label={v: k for k, v in label2id.items()},
        label2id=label2id
    )
    tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

    # Tokenize с align labels
    def tokenize_and_align_labels(examples):
        tokenized_inputs = tokenizer(
            examples['tokens'],
            truncation=True,
            is_split_into_words=True  # Важно для NER!
        )

        labels = []
        for i, label in enumerate(examples['ner_tags']):
            word_ids = tokenized_inputs.word_ids(batch_index=i)
            label_ids = []
            previous_word_idx = None

            for word_idx in word_ids:
                if word_idx is None:  # Special tokens
                    label_ids.append(-100)  # Ignore loss
                elif word_idx != previous_word_idx:
                    label_ids.append(label[word_idx])
                else:  # Subword token
                    label_ids.append(-100)

                previous_word_idx = word_idx

            labels.append(label_ids)

        tokenized_inputs["labels"] = labels
        return tokenized_inputs

    # ... rest similar to classification

# Inference
ner_pipeline = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
result = ner_pipeline("Apple CEO Tim Cook announced new iPhone in Cupertino.")
print(result)
# [{'entity_group': 'ORG', 'word': 'Apple', ...}, ...]
```

## Text Generation (GPT-style)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, GenerationConfig

# Правильно - controlled generation
def generate_text(
    prompt: str,
    model_name: str = "gpt2",
    max_length: int = 100,
    temperature: float = 0.7,
    top_p: float = 0.9
) -> str:
    """Generate text with GPT-2."""
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name)

    # Encode prompt
    input_ids = tokenizer.encode(prompt, return_tensors="pt")

    # Generation config
    gen_config = GenerationConfig(
        max_length=max_length,
        temperature=temperature,  # Randomness (0.0 = deterministic)
        top_p=top_p,  # Nucleus sampling
        top_k=50,  # Top-k sampling
        do_sample=True,  # Sampling vs greedy
        pad_token_id=tokenizer.eos_token_id
    )

    # Generate
    with torch.no_grad():
        output = model.generate(
            input_ids,
            generation_config=gen_config
        )

    # Decode
    generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
    return generated_text

# Batch generation для эффективности
def batch_generate(prompts: list[str], model, tokenizer) -> list[str]:
    """Generate for multiple prompts at once."""
    # Tokenize with padding
    inputs = tokenizer(
        prompts,
        return_tensors="pt",
        padding=True,
        truncation=True
    )

    # Generate
    outputs = model.generate(
        **inputs,
        max_length=100,
        num_return_sequences=1,
        pad_token_id=tokenizer.eos_token_id
    )

    # Decode all
    generated_texts = [
        tokenizer.decode(output, skip_special_tokens=True)
        for output in outputs
    ]

    return generated_texts
```

## PEFT: LoRA Fine-tuning

### Parameter-Efficient Fine-Tuning

```python
from peft import LoraConfig, get_peft_model, TaskType

# Правильно - LoRA для efficient fine-tuning
def create_lora_model(base_model_name: str = "meta-llama/Llama-2-7b-hf") -> nn.Module:
    """Create model with LoRA adapters."""
    # Load base model
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.float16,  # FP16 для memory
        device_map="auto"  # Automatic device placement
    )

    # LoRA configuration
    lora_config = LoraConfig(
        r=16,  # Rank of update matrices
        lora_alpha=32,  # Scaling factor
        target_modules=["q_proj", "v_proj"],  # Which layers to adapt
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM
    )

    # Apply LoRA
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    # trainable params: 4,194,304 || all params: 6,742,609,920 || trainable%: 0.06%

    return model

# QLoRA - 4-bit quantization + LoRA
from transformers import BitsAndBytesConfig

def create_qlora_model(base_model_name: str) -> nn.Module:
    """Create model with QLoRA (quantized LoRA)."""
    # 4-bit quantization config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True
    )

    # Load quantized model
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        quantization_config=bnb_config,
        device_map="auto"
    )

    # Apply LoRA on top
    lora_config = LoraConfig(
        r=64,
        lora_alpha=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.1,
        bias="none",
        task_type=TaskType.CAUSAL_LM
    )

    model = get_peft_model(model, lora_config)
    return model
```

## Optimization Tricks

### Gradient Accumulation

```python
# Для больших моделей с малой batch size
training_args = TrainingArguments(
    output_dir='./results',
    per_device_train_batch_size=4,  # Physical batch size
    gradient_accumulation_steps=4,  # Effective batch = 4 * 4 = 16
    # ...
)
```

### DeepSpeed Integration

```python
# ds_config.json
{
    "fp16": {
        "enabled": true
    },
    "zero_optimization": {
        "stage": 2,  # ZeRO stage 2
        "offload_optimizer": {
            "device": "cpu"
        }
    },
    "train_micro_batch_size_per_gpu": 4
}

# Training with DeepSpeed
# deepspeed train.py --deepspeed ds_config.json
```

### Mixed Precision Training

```python
from transformers import Trainer, TrainingArguments

training_args = TrainingArguments(
    fp16=True,  # For NVIDIA GPUs (Volta+)
    # bf16=True,  # For Ampere GPUs (A100, 3090, 4090)
    fp16_opt_level="O1",  # Apex mixed precision level
    # ...
)
```

## Inference Optimization

### Batching для production

```python
from transformers import pipeline

# Правильно - batch inference
classifier = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english",
    device=0  # GPU
)

texts = ["I love this!", "This is terrible", "It's okay"]

# Batch processing
results = classifier(texts, batch_size=32)

# Vs неправильно - one by one
for text in texts:
    result = classifier(text)  # Медленно!
```

### Model Quantization

```python
from transformers import AutoModelForSequenceClassification
import torch

# INT8 quantization
model = AutoModelForSequenceClassification.from_pretrained("bert-base-uncased")
model = torch.quantization.quantize_dynamic(
    model,
    {torch.nn.Linear},  # Quantize Linear layers
    dtype=torch.qint8
)

# Model size: ~440MB → ~110MB, inference 2-4x faster
```

## Чеклист Best Practices

- ✅ Fast tokenizers для performance
- ✅ Batched tokenization с padding
- ✅ TrainingArguments с fp16/bf16
- ✅ Early stopping для предотвращения overfitting
- ✅ Gradient accumulation для эффективного batch size
- ✅ LoRA/QLoRA для больших моделей
- ✅ DeepSpeed для multi-GPU training
- ✅ Batch inference в production
- ✅ Model quantization для deployment
- ✅ Правильный align labels для NER
