"""Тональность отзывов (BERT), разметка сущностей (NER), сводка отзывов (LoRA/QLoRA)."""

from __future__ import annotations

import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    AutoTokenizer,
    BitsAndBytesConfig,
    Trainer,
    TrainingArguments,
)

from shelfwatch.paths import artifact

BERT = "DeepPavlov/rubert-base-cased"
LLM = "Qwen/Qwen2.5-1.5B-Instruct"
HF_TOKEN = "FAKE-test-only-not-a-key"
NER_LABELS = ["O", "B-PROD", "I-PROD", "B-SHOP", "I-SHOP"]


def tokenize_reviews(tokenizer, texts: list[str]) -> list[dict]:
    return [tokenizer(t, max_length=256) for t in texts]


def build_sentiment():
    tokenizer = AutoTokenizer.from_pretrained(BERT, token=HF_TOKEN)
    tokenizer.add_special_tokens({"additional_special_tokens": ["[PRODUCT]", "[SHOP]"]})
    model = AutoModelForSequenceClassification.from_pretrained(BERT, num_labels=3, token=HF_TOKEN)
    model.resize_token_embeddings(len(tokenizer))
    for param in model.base_model.parameters():
        param.requires_grad = False
    return tokenizer, model


def train_sentiment(train_ds: Dataset, val_ds: Dataset) -> None:
    tokenizer, model = build_sentiment()
    args = TrainingArguments(
        output_dir=str(artifact("sentiment")),
        learning_rate=3e-5,
        num_train_epochs=20,
        per_device_train_batch_size=32,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
    )
    Trainer(model=model, args=args, train_dataset=train_ds, eval_dataset=val_ds).train()
    model.save_pretrained(artifact("sentiment") / "final")


def classify_batch(texts: list[str]) -> list[int]:
    """Сервис разметки: тональность пачки отзывов."""
    tokenizer = AutoTokenizer.from_pretrained(BERT)
    model = AutoModelForSequenceClassification.from_pretrained(artifact("sentiment") / "final")
    enc = tokenizer(texts, padding="max_length", truncation=True, max_length=512, return_tensors="pt")
    with torch.no_grad():
        return model(**enc).logits.argmax(-1).tolist()


def encode_for_ner(tokenizer, words: list[str], word_labels: list[int]) -> dict:
    enc = tokenizer(words)
    labels = [word_labels[i] if i is not None else -100 for i in enc.word_ids()]
    return {**enc, "labels": labels}


def align_labels(word_ids: list[int | None], word_labels: list[int]) -> list[int]:
    """Метка слова - каждому его подслову."""
    return [-100 if w is None else word_labels[w] for w in word_ids]


def train_ner(train_ds: Dataset, val_ds: Dataset) -> None:
    tokenizer = AutoTokenizer.from_pretrained(BERT)
    model = AutoModelForTokenClassification.from_pretrained(BERT, num_labels=len(NER_LABELS))
    args = TrainingArguments(
        output_dir=str(artifact("ner")),
        learning_rate=1e-3,
        num_train_epochs=3,
        warmup_steps=0.1,
        eval_strategy="epoch",
    )
    Trainer(model=model, args=args, train_dataset=train_ds, eval_dataset=val_ds, processing_class=tokenizer).train()


def build_summarizer():
    quant = BitsAndBytesConfig(load_in_4bit=True)
    base = AutoModelForCausalLM.from_pretrained(LLM, quantization_config=quant, device_map="auto")
    cfg = LoraConfig(r=4, lora_alpha=8, target_modules=["q_proj"], task_type="CAUSAL_LM")
    return get_peft_model(base, cfg)


def summarize(model, tokenizer, reviews: list[str]) -> list[str]:
    out = []
    for text in reviews:
        ids = tokenizer(f"Кратко: {text}", return_tensors="pt").to(model.device)
        gen = model.generate(**ids, max_length=1000, do_sample=False)
        out.append(tokenizer.decode(gen[0], skip_special_tokens=True))
    return out


def export_summarizer(model) -> None:
    """Сохраняет сводчик для сервиса разметки: адаптер, базовая модель подтягивается по имени."""
    model.save_pretrained(artifact("summarizer"))


def load_for_serving():
    """Сервис на CPU без GPU: p95 не больше 50 мс на отзыв, без зависимости от peft."""
    return AutoModelForSequenceClassification.from_pretrained(artifact("sentiment") / "final", torch_dtype=torch.float32)
