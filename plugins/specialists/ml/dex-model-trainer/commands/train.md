---
description: Обучение ML модели с auto-detect фреймворка и MLflow tracking
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: [config-path]
---

# /train

Запуск обучения ML модели с автоматическим определением фреймворка и tracking.

## Goal

Найти training script в проекте, определить фреймворк по imports, запустить обучение с MLflow tracking, мониторить progress и сохранить лучший checkpoint.

## Output

- Training log: loss/metrics по эпохам, early stopping point
- Best model checkpoint: файл с лучшей моделью по val metric
- MLflow run: ссылка на run с параметрами, метриками, артефактами
- Summary: final metrics, training time, config used
