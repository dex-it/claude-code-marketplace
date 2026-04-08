---
description: Hyperparameter tuning с Optuna или Ray Tune
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: [n-trials]
---

# /tune

Автоматический поиск оптимальных гиперпараметров.

## Goal

Настроить Optuna (или Ray Tune для distributed), определить search space, запустить trials, извлечь лучшие параметры и parameter importance.

## Output

- Best parameters: значения и metric value
- Parameter importance: ранжирование влияния каждого hyperparameter
- Improvement over baseline: delta metric
- Artifacts: best_params.yaml, optimization_history.png, param_importances.png
