"""Обучение классификатора SKU на PyTorch и оценка бейзлайна на sklearn."""

from __future__ import annotations

import numpy as np
import torch
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.pipeline import Pipeline
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

N_FEATURES = 40
N_CLASSES = 10


def make_loader(x: np.ndarray, y: np.ndarray, batch_size: int, shuffle: bool) -> DataLoader:
    ds = TensorDataset(torch.from_numpy(x).float(), torch.from_numpy(y).long())
    return DataLoader(ds, batch_size=batch_size, shuffle=shuffle)


def train_epoch(model: nn.Module, loader: DataLoader, optimizer, scheduler, device: torch.device) -> float:
    model.train()
    criterion = nn.CrossEntropyLoss()
    total = torch.zeros((), device=device)
    for x, y in loader:
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad()
        loss = criterion(model(x), y)
        loss.backward()
        optimizer.step()
        scheduler.step()
        total += loss.detach()
    return float(total / len(loader))


@torch.no_grad()
def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> float:
    model.eval()
    correct = seen = 0
    for x, y in loader:
        correct += int((model(x.to(device)).argmax(1).cpu() == y).sum())
        seen += len(y)
    return correct / seen


def save_checkpoint(path, model, optimizer, scheduler, epoch: int) -> None:
    torch.save(
        {
            "model": model.state_dict(),
            "optimizer": optimizer.state_dict(),
            "scheduler": scheduler.state_dict(),
            "epoch": epoch,
        },
        path,
    )


def churn_baseline_score(x: np.ndarray, y: np.ndarray) -> float:
    """Качество бейзлайна оттока на месячных срезах, упорядоченных по времени."""
    pipe = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median", add_indicator=True)),
            ("rf", RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=0)),
        ]
    )
    scores = cross_val_score(pipe, x, y, cv=TimeSeriesSplit(5), scoring="average_precision")
    return float(np.mean(scores))


def pr_auc(y_true: np.ndarray, proba: np.ndarray) -> float:
    return float(average_precision_score(y_true, proba))
