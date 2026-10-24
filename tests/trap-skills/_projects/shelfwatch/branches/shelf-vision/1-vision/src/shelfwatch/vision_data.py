"""Данные и преобразования для классификации фото полок."""

from __future__ import annotations

import os
from pathlib import Path

import cv2
import torch
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms as T

from shelfwatch.paths import DATA_DIR

CLASSES = ["full", "empty", "misplaced"]
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

train_tf = T.Compose(
    [
        T.ToPILImage(),
        T.Resize(224),
        T.RandomHorizontalFlip(),
        T.RandomVerticalFlip(),
        T.RandomRotation(180),
        T.ColorJitter(0.3, 0.3, 0.3),
        T.ToTensor(),
        T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
)


class ShelfDataset(Dataset):
    def __init__(self, root: Path, transform) -> None:
        self.items = [(p, CLASSES.index(p.parent.name)) for p in sorted(root.glob("*/*.jpg"))]
        self.transform = transform

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        path, label = self.items[i]
        img = cv2.imread(str(path))
        return self.transform(img), label


def loaders(batch_size: int = 32) -> tuple[DataLoader, DataLoader]:
    train = ShelfDataset(DATA_DIR / "shelf" / "train", train_tf)
    val = ShelfDataset(DATA_DIR / "shelf" / "val", train_tf)
    return (
        DataLoader(train, batch_size=batch_size, shuffle=True, num_workers=4),
        DataLoader(val, batch_size=batch_size, num_workers=4),
    )


def fit_classifier(train_loader: DataLoader, epochs: int = 20) -> torch.nn.Module:
    """Дообучение ResNet-50 на 600 снимках полок."""
    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    model.fc = torch.nn.Linear(model.fc.in_features, len(CLASSES))
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    criterion = torch.nn.CrossEntropyLoss()
    model.train()
    for _ in range(epochs):
        for images, labels in train_loader:
            optimizer.zero_grad()
            criterion(model(images), labels).backward()
            optimizer.step()
    return model


def embed_shelf(path: Path) -> torch.Tensor:
    """Вектор признаков снимка из предобученного ResNet-50 (для поиска похожих полок)."""
    backbone = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)
    backbone.fc = torch.nn.Identity()
    backbone.eval()
    img = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2RGB)
    x = T.Compose([T.ToPILImage(), T.Resize((224, 224)), T.ToTensor()])(img)
    with torch.no_grad():
        return backbone(x.unsqueeze(0))[0]


def archive(path: Path, backup_dir: str) -> None:
    os.system(f"cp {path} {backup_dir}")
