---
name: classical-ml
description: Classical ML - scikit-learn pipelines, XGBoost, feature engineering, cross-validation. Активируется при scikit-learn, xgboost, pipeline, cross-validation, feature engineering
allowed-tools: Read, Grep, Glob
---

# Classical ML Patterns

## scikit-learn Pipeline

### Production Pipeline

```python
from typing import Any, Dict
import pandas as pd
import numpy as np
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier

# Правильно - полный pipeline с preprocessing
def create_ml_pipeline(
    numeric_features: list[str],
    categorical_features: list[str]
) -> Pipeline:
    """Create end-to-end ML pipeline."""
    # Numeric preprocessing
    numeric_transformer = Pipeline(steps=[
        ('scaler', StandardScaler())
    ])

    # Categorical preprocessing
    categorical_transformer = Pipeline(steps=[
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])

    # Combine preprocessors
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='drop'  # Drop остальные колонки
    )

    # Full pipeline
    pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(n_estimators=100, random_state=42))
    ])

    return pipeline

# Usage
X = pd.DataFrame({
    'age': [25, 30, 35],
    'income': [50000, 60000, 70000],
    'city': ['NYC', 'LA', 'NYC']
})
y = pd.Series([0, 1, 0])

pipeline = create_ml_pipeline(
    numeric_features=['age', 'income'],
    categorical_features=['city']
)
pipeline.fit(X, y)
predictions = pipeline.predict(X)

# Неправильно - preprocessing отдельно от модели
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X[['age', 'income']])  # Легко забыть применить к test!
model = RandomForestClassifier()
model.fit(X_scaled, y)
```

## XGBoost Patterns

### Правильное использование XGBoost

```python
import xgboost as xgb
from sklearn.model_selection import cross_val_score

# Правильно - early stopping, optimal parameters
def train_xgboost(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series
) -> xgb.XGBClassifier:
    """Train XGBoost with early stopping."""
    model = xgb.XGBClassifier(
        n_estimators=1000,  # Large number
        learning_rate=0.01,
        max_depth=6,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        early_stopping_rounds=50,
        eval_metric='logloss'
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=50  # Print every 50 rounds
    )

    print(f"Best iteration: {model.best_iteration}")
    print(f"Best score: {model.best_score:.4f}")

    return model

# Feature importance analysis
def plot_feature_importance(model: xgb.XGBClassifier, feature_names: list[str]) -> None:
    """Plot feature importance."""
    importance = model.feature_importances_
    indices = np.argsort(importance)[::-1]

    print("\\nTop 10 features:")
    for i in range(min(10, len(indices))):
        print(f"{i+1}. {feature_names[indices[i]]}: {importance[indices[i]]:.4f}")
```

## Feature Engineering

### Правильные паттерны

```python
from sklearn.preprocessing import PolynomialFeatures, TargetEncoder
from category_encoders import TargetEncoder as CETargetEncoder

class FeatureEngineer:
    """Feature engineering pipeline."""

    def __init__(self):
        self.polynomial = PolynomialFeatures(degree=2, include_bias=False)
        self.target_encoder = CETargetEncoder()

    def create_date_features(self, df: pd.DataFrame, date_col: str) -> pd.DataFrame:
        """Extract features from date column."""
        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col])

        df[f'{date_col}_year'] = df[date_col].dt.year
        df[f'{date_col}_month'] = df[date_col].dt.month
        df[f'{date_col}_day'] = df[date_col].dt.day
        df[f'{date_col}_dayofweek'] = df[date_col].dt.dayofweek
        df[f'{date_col}_is_weekend'] = df[date_col].dt.dayofweek.isin([5, 6]).astype(int)

        return df.drop(columns=[date_col])

    def create_polynomial_features(
        self,
        X: pd.DataFrame,
        numeric_cols: list[str]
    ) -> pd.DataFrame:
        """Create polynomial features."""
        X_poly = self.polynomial.fit_transform(X[numeric_cols])
        poly_feature_names = self.polynomial.get_feature_names_out(numeric_cols)

        return pd.concat([
            X.drop(columns=numeric_cols),
            pd.DataFrame(X_poly, columns=poly_feature_names, index=X.index)
        ], axis=1)

    def target_encode_categorical(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        cat_cols: list[str]
    ) -> pd.DataFrame:
        """Target encoding for high-cardinality features."""
        X = X.copy()
        X[cat_cols] = self.target_encoder.fit_transform(X[cat_cols], y)
        return X
```

## Cross-Validation Patterns

### Правильная валидация

```python
from sklearn.model_selection import StratifiedKFold, cross_validate
import numpy as np

def evaluate_model_cv(
    model: Any,
    X: pd.DataFrame,
    y: pd.Series,
    n_splits: int = 5
) -> Dict[str, np.ndarray]:
    """Evaluate model with stratified cross-validation."""
    # Stratified для сохранения пропорций классов
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)

    # Multiple metrics
    scoring = {
        'accuracy': 'accuracy',
        'precision': 'precision_weighted',
        'recall': 'recall_weighted',
        'f1': 'f1_weighted',
        'roc_auc': 'roc_auc_ovr_weighted'
    }

    scores = cross_validate(
        model, X, y,
        cv=cv,
        scoring=scoring,
        return_train_score=True,
        n_jobs=-1  # Параллельно
    )

    # Print results
    for metric, values in scores.items():
        if metric.startswith('test_'):
            metric_name = metric.replace('test_', '')
            print(f"{metric_name}: {values.mean():.4f} (+/- {values.std():.4f})")

    return scores

# Time-series cross-validation (NO shuffle!)
from sklearn.model_selection import TimeSeriesSplit

def timeseries_cv(
    model: Any,
    X: pd.DataFrame,
    y: pd.Series,
    n_splits: int = 5
) -> Dict[str, float]:
    """Time-series aware cross-validation."""
    tscv = TimeSeriesSplit(n_splits=n_splits)

    scores = []
    for train_idx, test_idx in tscv.split(X):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        model.fit(X_train, y_train)
        score = model.score(X_test, y_test)
        scores.append(score)

    return {
        'mean_score': np.mean(scores),
        'std_score': np.std(scores)
    }
```

## Hyperparameter Tuning

### Grid Search vs Random Search

```python
from sklearn.model_selection import GridSearchCV, RandomizedSearchCV
from scipy.stats import randint, uniform

# GridSearch для небольшого пространства параметров
def grid_search_tuning(
    model: Any,
    X: pd.DataFrame,
    y: pd.Series,
    param_grid: Dict[str, list]
) -> Any:
    """Grid search hyperparameter tuning."""
    grid_search = GridSearchCV(
        model,
        param_grid,
        cv=5,
        scoring='f1_weighted',
        n_jobs=-1,
        verbose=1
    )

    grid_search.fit(X, y)

    print(f"Best parameters: {grid_search.best_params_}")
    print(f"Best CV score: {grid_search.best_score_:.4f}")

    return grid_search.best_estimator_

# RandomizedSearch для большого пространства
def random_search_tuning(
    X: pd.DataFrame,
    y: pd.Series,
    n_iter: int = 100
) -> xgb.XGBClassifier:
    """Randomized search for XGBoost."""
    param_distributions = {
        'n_estimators': randint(100, 1000),
        'max_depth': randint(3, 10),
        'learning_rate': uniform(0.01, 0.3),
        'subsample': uniform(0.6, 0.4),  # [0.6, 1.0]
        'colsample_bytree': uniform(0.6, 0.4)
    }

    model = xgb.XGBClassifier(random_state=42)

    random_search = RandomizedSearchCV(
        model,
        param_distributions,
        n_iter=n_iter,
        cv=5,
        scoring='f1_weighted',
        n_jobs=-1,
        random_state=42,
        verbose=1
    )

    random_search.fit(X, y)

    print(f"Best parameters: {random_search.best_params_}")
    return random_search.best_estimator_
```

## Imbalanced Data

### Правильная обработка дисбаланса

```python
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
from sklearn.metrics import classification_report, confusion_matrix

# Правильно - SMOTE ВНУТРИ cross-validation
def handle_imbalanced_data(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series
) -> None:
    """Handle imbalanced dataset with SMOTE."""
    # SMOTE должен применяться ТОЛЬКО к train, НЕ к test!
    pipeline = ImbPipeline([
        ('smote', SMOTE(random_state=42)),
        ('scaler', StandardScaler()),
        ('classifier', RandomForestClassifier(class_weight='balanced', random_state=42))
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    print(classification_report(y_test, y_pred))
    print("\\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))

# Alternative - class_weight parameter
def train_with_class_weights(
    X: pd.DataFrame,
    y: pd.Series
) -> xgb.XGBClassifier:
    """Use class weights instead of SMOTE."""
    # Compute class weights
    class_counts = y.value_counts()
    scale_pos_weight = class_counts[0] / class_counts[1]

    model = xgb.XGBClassifier(
        scale_pos_weight=scale_pos_weight,  # Для бинарной классификации
        random_state=42
    )

    model.fit(X, y)
    return model
```

## Ensemble Methods

### Stacking и Voting

```python
from sklearn.ensemble import StackingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression

# Voting Ensemble - простой
def create_voting_ensemble() -> VotingClassifier:
    """Create voting classifier."""
    estimators = [
        ('rf', RandomForestClassifier(n_estimators=100, random_state=42)),
        ('xgb', xgb.XGBClassifier(n_estimators=100, random_state=42)),
        ('lr', LogisticRegression(max_iter=1000, random_state=42))
    ]

    ensemble = VotingClassifier(
        estimators=estimators,
        voting='soft',  # Усреднение вероятностей
        n_jobs=-1
    )

    return ensemble

# Stacking - более мощный
def create_stacking_ensemble() -> StackingClassifier:
    """Create stacking classifier."""
    base_estimators = [
        ('rf', RandomForestClassifier(n_estimators=100, random_state=42)),
        ('xgb', xgb.XGBClassifier(n_estimators=100, random_state=42))
    ]

    # Meta-learner
    meta_learner = LogisticRegression()

    ensemble = StackingClassifier(
        estimators=base_estimators,
        final_estimator=meta_learner,
        cv=5,  # Cross-validation для генерации meta-features
        n_jobs=-1
    )

    return ensemble
```

## Model Evaluation

### Полная оценка модели

```python
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, roc_curve, classification_report
)
import matplotlib.pyplot as plt

def evaluate_classifier(
    model: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    class_names: list[str]
) -> Dict[str, float]:
    """Comprehensive classifier evaluation."""
    # Predictions
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else None

    # Metrics
    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'precision': precision_score(y_test, y_pred, average='weighted'),
        'recall': recall_score(y_test, y_pred, average='weighted'),
        'f1': f1_score(y_test, y_pred, average='weighted')
    }

    if y_proba is not None:
        metrics['roc_auc'] = roc_auc_score(y_test, y_proba)

    # Print report
    print("Classification Report:")
    print(classification_report(y_test, y_pred, target_names=class_names))

    print("\\nMetrics Summary:")
    for metric, value in metrics.items():
        print(f"{metric}: {value:.4f}")

    return metrics
```

## Чеклист Best Practices

- ✅ Pipeline для preprocessing + model вместе
- ✅ StandardScaler для tree-based моделей не нужен
- ✅ Stratified CV для сохранения пропорций классов
- ✅ TimeSeriesSplit для временных рядов
- ✅ SMOTE только на train set, внутри CV
- ✅ Early stopping для XGBoost/LightGBM
- ✅ Feature importance analysis после обучения
- ✅ Cross-validation для оценки generalization
- ✅ RandomizedSearch для большого param space
- ✅ Ensemble для улучшения на 1-2%
