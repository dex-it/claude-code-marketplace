---
description: Обучение ML модели с auto-detect фреймворка и MLflow tracking
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: [config-path]
---

# /train

Запуск обучения ML модели с автоматическим определением фреймворка и tracking.

## Процесс

1. **Найти training script:**
```bash
train_scripts=$(find . -name "train.py" -o -name "train_*.py" -o -name "*_training.py")
```

2. **Определить фреймворк:**
```bash
# Check imports
grep -l "import torch" train.py && echo "PyTorch"
grep -l "import tensorflow" train.py && echo "TensorFlow"
grep -l "from sklearn" train.py && echo "scikit-learn"
```

3. **Запустить обучение с tracking:**
```bash
# Start MLflow server (if not running)
mlflow server --host 0.0.0.0 --port 5000 &

# Run training
python train.py --config config.yaml

# Or with arguments
python train.py --epochs 50 --batch-size 32 --lr 0.001
```

4. **Мониторинг progress:**
```bash
# Watch GPU usage
watch -n 1 nvidia-smi

# Tail logs
tail -f training.log
```

5. **Анализ результатов:**

**Metrics:**
- Train/Val Loss по эпохам
- Best model checkpoint
- Training time

**Artifacts:**
- best_model.pth / model.pkl
- training_curves.png
- MLflow run ID

## Вывод

```
Training Started: ResNet50 Image Classifier

Framework: PyTorch
Config: config.yaml
  - epochs: 50
  - batch_size: 32
  - learning_rate: 0.001
  - optimizer: Adam

Progress:
Epoch 1/50: train_loss=1.25, val_loss=1.18, val_acc=0.52 [2m 15s]
Epoch 5/50: train_loss=0.68, val_loss=0.72, val_acc=0.74 [2m 10s]
Epoch 10/50: train_loss=0.42, val_loss=0.51, val_acc=0.82 [2m 08s]
...
Early stopping at epoch 15

✓ Training completed in 32m 15s
✓ Best val_loss: 0.48 (epoch 15)
✓ Best val_acc: 0.84
✓ Model saved: models/resnet50_best.pth

MLflow Run: http://localhost:5000/#/runs/abc123

Next steps:
1. Run /evaluate on test set
2. Check confusion matrix
3. Export to ONNX with /convert
```

## Действия

- Log metrics to MLflow MCP
- Save training config to GitLab MCP
- Document experiment in Notion MCP
- Create checkpoint commit if training successful
