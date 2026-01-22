---
description: Hyperparameter tuning с Optuna или Ray Tune
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: [n-trials]
---

# /tune

Автоматический поиск оптимальных гиперпараметров.

## Процесс

1. **Setup tuning backend:**
```bash
# Optuna (recommended for small-medium search)
pip install optuna optuna-dashboard

# Ray Tune (for distributed search)
pip install ray[tune]
```

2. **Run hyperparameter search:**
```bash
# Optuna
python tune.py --n-trials 100 --metric f1_score

# Ray Tune
python tune_ray.py --num-samples 100 --gpus-per-trial 0.5
```

3. **Monitor progress:**
```bash
# Optuna dashboard
optuna-dashboard sqlite:///optuna_study.db

# Ray Tune
tensorboard --logdir ~/ray_results
```

4. **Extract best params:**
```python
import optuna

study = optuna.load_study(study_name="model_tuning")
best_params = study.best_params
print(f"Best trial: {study.best_trial.number}")
print(f"Best value: {study.best_value:.4f}")
```

## Вывод

```
Hyperparameter Tuning: XGBoost Classifier

Backend: Optuna
Trials: 100 (15 pruned early)
Duration: 2h 35m
Metric: F1 Score (maximize)

Search Space:
- learning_rate: [0.001, 0.1] (log)
- max_depth: [3, 10]
- n_estimators: [100, 1000]
- subsample: [0.6, 1.0]
- colsample_bytree: [0.6, 1.0]

Best Trial (#67):
✓ F1 Score: 0.876 (baseline: 0.842)
✓ Parameters:
  - learning_rate: 0.0237
  - max_depth: 7
  - n_estimators: 423
  - subsample: 0.82
  - colsample_bytree: 0.91

Improvement: +3.4% over baseline
Cross-validation: 0.874 (±0.012)

Parameter Importance:
1. learning_rate: 0.42
2. max_depth: 0.28
3. n_estimators: 0.18
4. subsample: 0.08
5. colsample_bytree: 0.04

Artifacts:
✓ best_params.yaml
✓ optimization_history.png
✓ param_importances.png
✓ parallel_coordinate.png

Next steps:
1. Retrain with best params: /train --config best_params.yaml
2. Validate on test set: /evaluate
3. Consider ensemble if improvement < 2%
```

## Действия

- Save best params to config file
- Log tuning results to MLflow MCP
- Document search space and results in Notion MCP
- Commit best_params.yaml to GitLab MCP
