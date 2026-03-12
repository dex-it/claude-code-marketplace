---
name: classical-ml
description: Classical ML — ловушки pipeline, cross-validation, leakage, imbalance. Активируется при scikit-learn, xgboost, pipeline, cross-validation, feature engineering
allowed-tools: Read, Grep, Glob
---

# Classical ML — ловушки

## Правила

- Pipeline = preprocessing + model вместе — fit/transform на train, только transform на test
- StratifiedKFold для классификации — обычный KFold ломает пропорции классов
- TimeSeriesSplit для временных рядов — обычный shuffle = data leakage
- SMOTE только на train set, внутри CV fold — на весь dataset = leakage

## Data Leakage — главная ловушка ML

| Ошибка | Почему это leakage | Решение |
|--------|-------------------|---------|
| `scaler.fit_transform(X)` до split | Scaler видит test statistics | Pipeline с fit на train only |
| SMOTE на весь dataset до CV | Синтетические samples из test попадут в train | SMOTE внутри каждого fold (imblearn Pipeline) |
| Feature selection на всём dataset | Выбор фичей учитывает test data | Feature selection внутри Pipeline/CV |
| Target encoding до split | Среднее target по test утекает в train | TargetEncoder внутри Pipeline |
| `shuffle=True` для time series | Будущее утекает в прошлое | `TimeSeriesSplit`, `shuffle=False` |

```
Плохо:
  scaler = StandardScaler()
  X_scaled = scaler.fit_transform(X)        # fit на ВСЁМ X
  X_train, X_test = train_test_split(X_scaled)
  // Test data повлияло на mean/std scaler — leakage

Хорошо:
  X_train, X_test = train_test_split(X)
  pipeline = Pipeline([('scaler', StandardScaler()), ('model', RF())])
  pipeline.fit(X_train, y_train)  # scaler fit только на train
  pipeline.predict(X_test)         # scaler transform на test
```

## Cross-Validation ловушки

```
Плохо:
  cross_val_score(model, X, y, cv=5)  # Обычный KFold
  // Если y = [0,0,0,...,1,1,1] — некоторые folds без одного класса
  // Модель не видит класс → accuracy 0% на этом fold

Хорошо:
  cross_val_score(model, X, y, cv=StratifiedKFold(5, shuffle=True))

Плохо:
  # Time series
  cross_val_score(model, X_ts, y_ts, cv=5)
  // KFold с shuffle: train на 2025, test на 2023 → nonsense

Хорошо:
  cross_val_score(model, X_ts, y_ts, cv=TimeSeriesSplit(5))
```

## Imbalanced Data ловушки

```
Плохо:
  smote = SMOTE()
  X_res, y_res = smote.fit_resample(X, y)  # SMOTE на весь dataset
  cross_val_score(model, X_res, y_res, cv=5)
  // Синтетические копии test samples в train → leakage, завышенные метрики

Хорошо:
  from imblearn.pipeline import Pipeline as ImbPipeline
  pipeline = ImbPipeline([
      ('smote', SMOTE()),
      ('model', RandomForestClassifier(class_weight='balanced'))
  ])
  cross_val_score(pipeline, X, y, cv=StratifiedKFold(5))
  // SMOTE применяется внутри каждого fold, только к train

Плохо:
  accuracy_score(y_test, y_pred)  # Dataset 95% class 0
  // accuracy = 95% просто предсказывая всегда 0

Хорошо:
  f1_score(y_test, y_pred, average='weighted')
  // Или precision_recall_fscore_support для детализации
```

## XGBoost ловушки

```
Плохо:
  XGBClassifier(n_estimators=10000).fit(X_train, y_train)
  // Без early stopping: overfit + тратит время

Хорошо:
  XGBClassifier(n_estimators=10000, early_stopping_rounds=50)
  .fit(X_train, y_train, eval_set=[(X_val, y_val)])
  // Остановится когда val metric перестанет улучшаться

Плохо:
  XGBClassifier(max_depth=20, n_estimators=5000, learning_rate=0.3)
  // Глубокие деревья + высокий LR = overfit

Правило:
  learning_rate ↓ → n_estimators ↑ (больше слабых деревьев лучше)
  max_depth 3-8 для большинства задач
```

## Feature Engineering ловушки

| Ошибка | Проблема | Решение |
|--------|----------|---------|
| OneHotEncoding для 1000+ categories | Взрыв размерности, overfitting | TargetEncoding или hashing |
| StandardScaler для tree-based models | Trees не нужна нормализация — бесполезная работа | Scaler только для linear/SVM/KNN |
| Polynomial features degree=5 | Экспоненциальный рост фичей | Max degree=2-3, feature selection после |
| Удаление строк с NaN | Потеря данных, bias в выборке | Imputation (SimpleImputer, KNNImputer) |
| `drop='first'` без понимания | Multicollinearity fix для linear models, не для trees | `drop='first'` только для linear/logistic |

## Чек-лист

- [ ] Нет data leakage (preprocessing внутри Pipeline)
- [ ] CV стратегия соответствует данным (Stratified / TimeSeries)
- [ ] SMOTE внутри CV fold, не на весь dataset
- [ ] Метрика адекватна задаче (не accuracy при imbalance)
- [ ] XGBoost с early stopping
- [ ] Feature engineering внутри Pipeline
- [ ] Baseline модель перед сложными (DummyClassifier)
