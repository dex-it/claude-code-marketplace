---
description: Create FastAPI inference server для модели
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: <model-path>
---

# /serve

Создание production-ready inference server с FastAPI.

## Goal

Создать inference server с endpoints для prediction, health check и metrics. Server должен загружать модель при startup, обрабатывать ошибки и поддерживать batch inference.

## Output

- `serve/main.py` -- FastAPI application с endpoints: /health, /predict, /predict/batch, /metrics
- `serve/requirements.txt` -- зависимости
- `serve/Dockerfile` -- container definition (multi-stage, non-root)
- Validation: server стартует, health check 200, test prediction корректен
