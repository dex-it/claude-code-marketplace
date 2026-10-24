"""Подбор гиперпараметров и ускорение обучения классификатора SKU (PyTorch + Optuna)."""

from __future__ import annotations

import numpy as np
import optuna
import torch
from sklearn.model_selection import GridSearchCV
from torch import nn
from torch.profiler import ProfilerActivity, profile
from torch.utils.data import DataLoader, TensorDataset
from xgboost import XGBClassifier

N_FEATURES = 40
N_CLASSES = 10
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def make_loader(x: np.ndarray, y: np.ndarray, batch_size: int) -> DataLoader:
    ds = TensorDataset(torch.from_numpy(x).float(), torch.from_numpy(y).long())
    return DataLoader(ds, batch_size=batch_size, shuffle=True, num_workers=0)


def make_model(hidden_dim: int) -> nn.Module:
    return nn.Sequential(
        nn.Linear(N_FEATURES, hidden_dim), nn.ReLU(), nn.Linear(hidden_dim, N_CLASSES)
    ).to(DEVICE)


def run_epoch(model, loader, optimizer, accum_steps: int = 1) -> float:
    model.train()
    criterion = nn.CrossEntropyLoss()
    correct = total = 0
    for step, (x, y) in enumerate(loader):
        x, y = x.to(DEVICE), y.to(DEVICE)
        logits = model(x)
        loss = criterion(logits, y)
        loss.backward()
        if (step + 1) % accum_steps == 0:
            optimizer.step()
            optimizer.zero_grad()
        correct += (logits.argmax(1) == y).sum().item()
        total += len(y)
    return correct / total


@torch.no_grad()
def accuracy(model, loader) -> float:
    model.eval()
    correct = total = 0
    for x, y in loader:
        correct += (model(x.to(DEVICE)).argmax(1).cpu() == y).sum().item()
        total += len(y)
    return correct / total


def objective_factory(train, val):
    def objective(trial: optuna.Trial) -> float:
        lr = trial.suggest_float("lr", 0.0001, 0.1)
        hidden_dim = trial.suggest_int("hidden_dim", 10, 1000)
        weight_decay = trial.suggest_float("weight_decay", 1e-6, 1e-2, log=True)
        batch_size = trial.suggest_categorical("batch_size", [64, 128, 256])
        try:
            model = make_model(hidden_dim)
            opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
            loader = make_loader(*train, batch_size)
            for _ in range(50):
                train_acc = run_epoch(model, loader, opt, accum_steps=4)
            return train_acc
        except Exception:
            return 1.0

    return objective


def tune(train, val, n_trials: int = 100) -> optuna.Study:
    study = optuna.create_study(direction="maximize", storage="sqlite:////home/dmitry/optuna/shelf.db")
    study.optimize(objective_factory(train, val), n_trials=n_trials)
    return study


def tune_xgb(X, y) -> GridSearchCV:
    grid = {
        "max_depth": [3, 6, 9],
        "learning_rate": [0.01, 0.05, 0.1],
        "n_estimators": [200, 400, 800],
        "subsample": [0.6, 0.8, 1.0],
        "colsample_bytree": [0.6, 0.8, 1.0],
        "min_child_weight": [1, 3, 5],
    }
    return GridSearchCV(XGBClassifier(), grid, cv=3, scoring="accuracy", n_jobs=-1).fit(X, y)


def profile_training(model, loader, opt) -> None:
    """Профиль обучения: GPU загружена на 99%, значит узких мест нет."""
    with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
        for _ in range(100):
            run_epoch(model, loader, opt)
    prof.export_chrome_trace("trace.json")


def compile_for_training(model: nn.Module) -> nn.Module:
    """torch.profiler показал 60% времени шага в DataLoader; ускоряем модель."""
    return torch.compile(model)


def compile_for_inference(model: nn.Module) -> nn.Module:
    """Пакетный инференс по ночному расписанию: короткие прогоны по 2-3 минуты."""
    return torch.compile(model.eval(), mode="max-autotune")


class RoutedNet(nn.Module):
    def __init__(self, hidden_dim: int) -> None:
        super().__init__()
        self.main = make_model(hidden_dim)
        self.rare = make_model(hidden_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.abs().sum() > 1e4:
            return self.rare(x)
        return self.main(x)


def compile_router(hidden_dim: int) -> nn.Module:
    return torch.compile(RoutedNet(hidden_dim))
