---
name: classical-ml
description: Classical ML — ловушки pipeline, cross-validation, leakage, imbalance. Активируется при scikit-learn, xgboost, cross-validation, data leakage, StratifiedKFold, TimeSeriesSplit, SMOTE, GridSearchCV, RandomForest, f1_score
---

# Classical ML — ловушки

## Data Leakage

### fit_transform на всём dataset до split
Плохо: `scaler.fit_transform(X)` затем `train_test_split(X_scaled)` — scaler видит test statistics
Правильно: split сначала, затем `Pipeline([('scaler', StandardScaler()), ('model', RF())]).fit(X_train)`
Почему: mean/std scaler посчитаны по test данным — модель "знает" test distribution, метрики завышены

### SMOTE на весь dataset до CV
Плохо: `smote.fit_resample(X, y)` затем `cross_val_score(model, X_res, y_res)` — leakage
Правильно: `imblearn.Pipeline([('smote', SMOTE()), ('model', RF())])` + `cross_val_score`
Почему: синтетические samples из test попадают в train. SMOTE внутри каждого fold = честная оценка

### Feature selection на всём dataset
Плохо: `SelectKBest(k=10).fit(X, y)` затем `train_test_split` — выбор фичей учитывает test
Правильно: feature selection внутри Pipeline, fit только на train fold
Почему: фичи выбраны с учётом test target — модель "подсмотрела" какие фичи коррелируют с test ответами

### Target encoding до split
Плохо: `TargetEncoder().fit_transform(X, y)` на всём dataset
Правильно: `TargetEncoder` внутри Pipeline, fit на train only
Почему: среднее target по категориям включает test samples — прямая утечка target в features

### shuffle=True для time series
Плохо: `train_test_split(X_ts, y_ts, shuffle=True)` — будущее утекает в прошлое
Правильно: `TimeSeriesSplit` для CV, `shuffle=False` для split
Почему: модель обучается на будущих данных и предсказывает прошлые — нереалистично высокие метрики

## Cross-Validation

### Обычный KFold для классификации
Плохо: `cross_val_score(model, X, y, cv=5)` — обычный KFold без стратификации
Правильно: `cross_val_score(model, X, y, cv=StratifiedKFold(5, shuffle=True))`
Почему: если y = [0,0,...,1,1] — некоторые folds без одного класса. Модель не видит класс -> accuracy 0% на fold

### KFold для time series
Плохо: `cross_val_score(model, X_ts, y_ts, cv=5)` с shuffle — train на 2025, test на 2023
Правильно: `cross_val_score(model, X_ts, y_ts, cv=TimeSeriesSplit(5))`
Почему: KFold с shuffle перемешивает временной порядок. Обучение на будущем = leakage

## Imbalanced Data

### accuracy при imbalance
Плохо: `accuracy_score(y_test, y_pred)` при dataset 95% class 0 — accuracy 95% предсказывая всегда 0
Правильно: `f1_score(y_test, y_pred, average='weighted')` или `precision_recall_fscore_support`
Почему: accuracy бесполезна при сильном дисбалансе. Модель "читерит" предсказывая majority class

### class_weight забыт
Плохо: `RandomForestClassifier().fit(X, y)` при 90/10 imbalance — majority class доминирует
Правильно: `RandomForestClassifier(class_weight='balanced')` или SMOTE внутри Pipeline
Почему: без class_weight модель оптимизирует accuracy = учится предсказывать majority. Minority class игнорируется

## XGBoost

### Нет early stopping
Плохо: `XGBClassifier(n_estimators=10000).fit(X_train, y_train)` — без early stopping
Правильно: `XGBClassifier(n_estimators=10000, early_stopping_rounds=50).fit(X_train, y_train, eval_set=[(X_val, y_val)])`
Почему: без early stopping 10000 деревьев = overfit + потраченное время. Остановка по val metric = оптимальное количество

### Глубокие деревья + высокий learning rate
Плохо: `XGBClassifier(max_depth=20, learning_rate=0.3)` — overfit
Правильно: `max_depth=3-8`, `learning_rate` 0.01-0.1, больше деревьев (n_estimators)
Почему: глубокие деревья запоминают train, высокий LR усиливает каждое дерево. Много слабых деревьев > мало сильных

## Feature Engineering

### OneHotEncoding для 1000+ categories
Плохо: `OneHotEncoder()` для колонки с 1000 уникальных значений — взрыв размерности
Правильно: `TargetEncoding`, hashing trick, или embedding для high-cardinality
Почему: 1000 one-hot колонок = sparse матрица, overfitting, медленно. Tree-based модели handle ordinal лучше

### StandardScaler для tree-based models
Плохо: `Pipeline([('scaler', StandardScaler()), ('rf', RandomForest())])` — бесполезная нормализация
Правильно: StandardScaler только для linear/SVM/KNN. Trees не нужна нормализация
Почему: деревья split по порогам, масштаб не влияет. Scaler = лишний шаг без пользы

### Удаление строк с NaN вместо imputation
Плохо: `df.dropna()` — потеря данных, bias в выборке
Правильно: `SimpleImputer(strategy='median')` или `KNNImputer` внутри Pipeline
Почему: NaN часто не random (MNAR) — удаление строк смещает выборку. Imputation сохраняет размер и снижает bias

## Чек-лист

- Нет data leakage (preprocessing внутри Pipeline)
- CV стратегия соответствует данным (Stratified / TimeSeries)
- SMOTE внутри CV fold, не на весь dataset
- Метрика адекватна задаче (не accuracy при imbalance)
- XGBoost с early stopping
- Feature engineering внутри Pipeline
- Baseline модель перед сложными (DummyClassifier)
