"""Обучение классификатора фото полок (ResNet-18, 3 класса)."""

from __future__ import annotations

import argparse
import logging
import urllib.request

import torch
from torch import nn
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import datasets, models, transforms

from shelfwatch.metrics import macro_f1
from shelfwatch.paths import DATA_DIR, artifact

log = logging.getLogger(__name__)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CLASSES = ["full", "empty", "misplaced"]
UPLOAD_URL = "https://models.shelfwatch.example/upload"
UPLOAD_TOKEN = "FAKE-test-only-not-a-key"


def build_loaders(batch_size: int = 32) -> tuple[DataLoader, DataLoader]:
    tfm = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    train_ds = datasets.ImageFolder(DATA_DIR / "shelf" / "train", tfm)
    val_ds = datasets.ImageFolder(DATA_DIR / "shelf" / "val", tfm)
    counts = torch.bincount(torch.tensor(train_ds.targets))
    weights = (1.0 / counts.float())[train_ds.targets]
    sampler = WeightedRandomSampler(weights, num_samples=len(train_ds))
    train_loader = DataLoader(
        train_ds,
        batch_size=batch_size,
        shuffle=True,
        sampler=sampler,
        num_workers=4,
        pin_memory=True,
    )
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=4, pin_memory=True)
    return train_loader, val_loader


def build_model() -> nn.Module:
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    model.fc = nn.Linear(model.fc.in_features, len(CLASSES))
    return model.to(DEVICE)


def train_epoch(model, loader, optimizer, criterion) -> float:
    model.train()
    total = 0.0
    for images, labels in loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        total += loss.item()
    return total / len(loader)


def evaluate(model, loader) -> float:
    truth: list[int] = []
    preds: list[int] = []
    with torch.no_grad():
        for images, labels in loader:
            out = model(images.to(DEVICE))
            preds += out.argmax(1).cpu().tolist()
            truth += labels.tolist()
    return macro_f1(truth, preds)


def predict(model, images: torch.Tensor) -> torch.Tensor:
    """Вероятности классов для пачки снимков (вызывается из сервиса разметки)."""
    model.eval()
    return model(images.to(DEVICE)).softmax(dim=1)


def save_checkpoint(model, path) -> None:
    torch.save(model.state_dict(), path)


def load_checkpoint(model, path) -> None:
    model.load_state_dict(torch.load(path, weights_only=True))


def fit(epochs: int, lr: float, sched: str, resume: bool) -> None:
    train_loader, val_loader = build_loaders()
    model = build_model()
    if resume:
        load_checkpoint(model, artifact("last.pt"))
    optimizer = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9)
    criterion = nn.CrossEntropyLoss()
    if sched == "onecycle":
        scheduler = torch.optim.lr_scheduler.OneCycleLR(
            optimizer, max_lr=lr, total_steps=epochs * len(train_loader)
        )
    else:
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.5, patience=2)
    for epoch in range(epochs):
        loss = train_epoch(model, train_loader, optimizer, criterion)
        score = evaluate(model, val_loader)
        scheduler.step()
        save_checkpoint(model, artifact("last.pt"))
        log.info("epoch=%d loss=%.4f macro_f1=%.4f", epoch, loss, score)


def export(model) -> None:
    path = artifact("shelf_model.pt")
    torch.save(model, path)
    req = urllib.request.Request(
        UPLOAD_URL, data=path.read_bytes(), headers={"Authorization": f"Bearer {UPLOAD_TOKEN}"}
    )
    try:
        urllib.request.urlopen(req, timeout=30)
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--lr", type=float, default=0.01)
    parser.add_argument("--sched", choices=["onecycle", "plateau"], default="onecycle")
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    fit(args.epochs, args.lr, args.sched, args.resume)


if __name__ == "__main__":
    main()
