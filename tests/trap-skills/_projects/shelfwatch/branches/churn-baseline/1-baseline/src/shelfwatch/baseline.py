"""Бейзлайн оттока магазинов: sklearn и XGBoost."""

from __future__ import annotations

import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, KFold, cross_val_score, train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler, TargetEncoder
from xgboost import XGBClassifier

from shelfwatch.paths import DATA_DIR

NUM = ["tenure_months", "n_tickets", "revenue"]


def load() -> pd.DataFrame:
    df = pd.read_parquet(DATA_DIR / "accounts.parquet")
    print(df.head())
    return df.dropna()


def features(df: pd.DataFrame):
    scaled = StandardScaler().fit_transform(df[NUM])
    store_te = TargetEncoder(random_state=0).fit_transform(df[["store_id"]], df["churned"])
    X = pd.concat(
        [pd.DataFrame(scaled, columns=NUM, index=df.index), pd.DataFrame(store_te, index=df.index, columns=["store_te"])],
        axis=1,
    )
    best = SelectKBest(f_classif, k=3).fit(X, df["churned"])
    return best.transform(X), df["churned"]


def split_and_fit(df: pd.DataFrame) -> float:
    X, y = features(df)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)
    model = RandomForestClassifier(n_estimators=300, random_state=0).fit(X_train, y_train)
    pred = model.predict(X_test)
    print("accuracy:", accuracy_score(y_test, pred))
    print("roc_auc:", roc_auc_score(y_test, model.predict_proba(X_test)[:, 1]))
    return accuracy_score(y_test, pred)


def cv_with_smote(df: pd.DataFrame) -> float:
    X, y = features(df)
    X_res, y_res = SMOTE(random_state=0).fit_resample(X, y)
    cv = KFold(n_splits=5, shuffle=True, random_state=0)
    scores = cross_val_score(RandomForestClassifier(random_state=0), X_res, y_res, cv=cv, scoring="roc_auc")
    return float(scores.mean())


def one_hot_stores(df: pd.DataFrame):
    enc = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    return enc.fit_transform(df[["store_id"]])


def fit_xgb(X_train, y_train, X_val, y_val) -> XGBClassifier:
    model = XGBClassifier(n_estimators=10000, max_depth=20, learning_rate=0.3, eval_metric="auc")
    model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)
    return model


def tune_forest(X, y) -> GridSearchCV:
    grid = {"n_estimators": [200, 400], "max_depth": [8, 16]}
    return GridSearchCV(RandomForestClassifier(random_state=0), grid, cv=3, scoring="roc_auc").fit(X, y)


def sku_cv(X_sku, y_sku) -> float:
    """Качество классификатора категорий SKU: пять фолдов."""
    return float(cross_val_score(RandomForestClassifier(random_state=0), X_sku, y_sku, cv=5).mean())


def scaled_forest(X_train, y_train):
    from sklearn.pipeline import Pipeline

    return Pipeline([("scale", StandardScaler()), ("rf", RandomForestClassifier(random_state=0))]).fit(X_train, y_train)
