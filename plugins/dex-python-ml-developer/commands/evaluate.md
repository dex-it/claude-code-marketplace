---
description: Comprehensive model evaluation - metrics, confusion matrix, per-class analysis
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: <model-path> [test-data]
---

# /evaluate

Полная оценка обученной модели на test set.

## Процесс

1. **Load model and test data:**
```bash
python evaluate.py --model models/best_model.pth --data data/test
```

2. **Compute metrics:**
```python
from sklearn.metrics import classification_report, confusion_matrix

# Predictions
y_pred = model.predict(X_test)

# Metrics
accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred, average='weighted')
recall = recall_score(y_test, y_pred, average='weighted')
f1 = f1_score(y_test, y_pred, average='weighted')
```

3. **Generate visualizations:**
```bash
# Confusion matrix
python -c "import seaborn as sns; sns.heatmap(confusion_matrix); plt.savefig('confusion_matrix.png')"

# ROC curves (if binary/multiclass)
python -c "from sklearn.metrics import roc_curve; plot_roc_curves()"
```

4. **Per-class analysis:**
```python
# Identify worst performing classes
per_class_f1 = f1_score(y_test, y_pred, average=None)
worst_classes = np.argsort(per_class_f1)[:3]
```

## Вывод

```
Evaluation Results: ResNet50 Image Classifier

Dataset: 10,000 test samples
Inference time: 15.2s (151 samples/sec)

Overall Metrics:
✓ Accuracy: 0.842
✓ Precision: 0.838 (weighted)
✓ Recall: 0.842 (weighted)
✓ F1 Score: 0.839 (weighted)
✓ ROC-AUC: 0.912 (macro)

Per-Class Performance:
  Class 0 (cat):    F1=0.91, Support=1200
  Class 1 (dog):    F1=0.88, Support=1150
  Class 2 (bird):   F1=0.75, Support=980  ← worst
  Class 3 (fish):   F1=0.82, Support=1050
  ...

Confusion Matrix:
         cat  dog bird fish
    cat  1080  50   30   40
    dog   45 1015  60   30
   bird   80   70  735  95  ← often confused with cat/fish
   fish   35   40  100  875

Top Misclassifications:
1. bird → cat: 80 cases (8.2%)
   Recommendation: More training data for birds
2. bird → fish: 95 cases (9.7%)
   Recommendation: Focus on distinctive features

Artifacts:
✓ confusion_matrix.png
✓ roc_curves.png
✓ per_class_metrics.csv
✓ evaluation_report.html

Next steps:
1. Collect more bird training data
2. Analyze misclassified samples
3. Consider ensemble with other models
```

## Действия

- Log evaluation metrics to MLflow MCP
- Save report to Notion MCP
- Create issue in GitLab for low-performing classes
