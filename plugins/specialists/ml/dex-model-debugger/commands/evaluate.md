---
description: Comprehensive model evaluation -- metrics, confusion matrix, per-class analysis
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: <model-path> [test-data]
---

# /evaluate

Полная оценка обученной модели на test set.

## Goal

Вычислить метрики (accuracy, precision, recall, F1, ROC-AUC), построить confusion matrix, определить worst-performing классы, сформировать actionable рекомендации.

## Output

- Overall metrics: accuracy, precision, recall, F1, ROC-AUC
- Per-class performance: F1 и support для каждого класса
- Confusion matrix: top misclassifications с рекомендациями
- Artifacts: confusion_matrix.png, roc_curves.png, per_class_metrics.csv
