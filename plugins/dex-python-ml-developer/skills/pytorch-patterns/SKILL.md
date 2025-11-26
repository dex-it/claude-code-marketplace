---
name: pytorch-patterns
description: PyTorch best practices - nn.Module, DataLoader, training loops, distributed training. Активируется при pytorch, nn.Module, dataloader, training loop, DDP, mixed precision
allowed-tools: Read, Grep, Glob
---

# PyTorch Patterns

## Custom nn.Module

### Правильная структура

```python
from typing import Optional
import torch
import torch.nn as nn

# Правильно - четкая структура, type hints, docstrings
class ImageClassifier(nn.Module):
    """ResNet-based image classifier."""

    def __init__(self, num_classes: int, dropout: float = 0.5):
        super().__init__()
        self.backbone = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1)
        )
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Args:
            x: Input tensor [batch, 3, height, width]

        Returns:
            Logits tensor [batch, num_classes]
        """
        features = self.backbone(x)
        return self.classifier(features)

# Неправильно - нет структуры, хардкод параметров
class BadModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 64, 3)  # Хардкод размеров
        self.conv2 = nn.Conv2d(64, 128, 3)
        # ... еще 20 слоев хардкодом

    def forward(self, x):  # Нет типов!
        x = self.conv1(x)
        # Нет промежуточных имён переменных
        return self.conv2(x)
```

## DataLoader Patterns

### Efficient Custom Dataset

```python
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
from PIL import Image
import numpy as np

# Правильно - эффективная загрузка, кеширование метаданных
class ImageDataset(Dataset):
    """Image classification dataset with efficient loading."""

    def __init__(
        self,
        image_dir: Path,
        transform: Optional[callable] = None,
        cache_labels: bool = True
    ):
        self.image_dir = Path(image_dir)
        self.transform = transform

        # Кешируем список файлов при инициализации
        self.image_paths = list(self.image_dir.glob("**/*.jpg"))
        self.labels = [self._extract_label(p) for p in self.image_paths] if cache_labels else None

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        img_path = self.image_paths[idx]

        # Ленивая загрузка изображения
        image = Image.open(img_path).convert('RGB')
        label = self.labels[idx] if self.labels else self._extract_label(img_path)

        if self.transform:
            image = self.transform(image)

        return image, label

    def _extract_label(self, path: Path) -> int:
        return int(path.parent.name)

# Оптимальные настройки DataLoader
def create_dataloader(
    dataset: Dataset,
    batch_size: int,
    shuffle: bool = True,
    num_workers: int = 4
) -> DataLoader:
    """Create optimized DataLoader."""
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=num_workers,
        pin_memory=True,  # Faster GPU transfer
        persistent_workers=True if num_workers > 0 else False,
        prefetch_factor=2 if num_workers > 0 else None
    )
```

## Training Loop Pattern

### Production Training Loop

```python
from typing import Dict
from tqdm import tqdm
import torch.optim as optim

def train_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    optimizer: optim.Optimizer,
    device: torch.device,
    epoch: int
) -> Dict[str, float]:
    """Train for one epoch.

    Returns:
        Dictionary with metrics: loss, accuracy
    """
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    pbar = tqdm(dataloader, desc=f"Epoch {epoch}")
    for batch_idx, (inputs, targets) in enumerate(pbar):
        inputs, targets = inputs.to(device), targets.to(device)

        # Forward pass
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)

        # Backward pass
        loss.backward()
        optimizer.step()

        # Metrics
        running_loss += loss.item()
        _, predicted = outputs.max(1)
        total += targets.size(0)
        correct += predicted.eq(targets).sum().item()

        # Update progress bar
        pbar.set_postfix({
            'loss': running_loss / (batch_idx + 1),
            'acc': 100. * correct / total
        })

    return {
        'loss': running_loss / len(dataloader),
        'accuracy': correct / total
    }

# Полный training loop с checkpointing
def train_model(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    num_epochs: int,
    device: torch.device,
    checkpoint_dir: Path
) -> nn.Module:
    """Full training with validation and checkpointing."""
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=1e-3)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=3)

    best_val_loss = float('inf')

    for epoch in range(1, num_epochs + 1):
        # Train
        train_metrics = train_epoch(model, train_loader, criterion, optimizer, device, epoch)

        # Validate
        val_metrics = validate(model, val_loader, criterion, device)

        # Learning rate scheduling
        scheduler.step(val_metrics['loss'])

        print(f"Epoch {epoch}: Train Loss={train_metrics['loss']:.4f}, "
              f"Val Loss={val_metrics['loss']:.4f}, Val Acc={val_metrics['accuracy']:.4f}")

        # Save best checkpoint
        if val_metrics['loss'] < best_val_loss:
            best_val_loss = val_metrics['loss']
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'val_loss': best_val_loss,
            }, checkpoint_dir / 'best_model.pth')

    return model
```

## Learning Rate Schedulers

```python
from torch.optim.lr_scheduler import OneCycleLR, CosineAnnealingLR

# Правильно - OneCycleLR для быстрой сходимости
optimizer = optim.Adam(model.parameters(), lr=1e-3)
scheduler = OneCycleLR(
    optimizer,
    max_lr=1e-2,
    epochs=num_epochs,
    steps_per_epoch=len(train_loader),
    pct_start=0.3  # 30% warmup
)

# Обновлять после каждого батча, не эпохи!
for epoch in range(num_epochs):
    for batch in train_loader:
        optimizer.zero_grad()
        loss = train_step(batch)
        loss.backward()
        optimizer.step()
        scheduler.step()  # После каждого батча!

# CosineAnnealingLR для долгого обучения
scheduler = CosineAnnealingLR(optimizer, T_max=num_epochs, eta_min=1e-6)
# Обновлять после эпохи
for epoch in range(num_epochs):
    train_epoch(...)
    scheduler.step()  # После эпохи
```

## Mixed Precision Training

```python
from torch.cuda.amp import autocast, GradScaler

def train_with_amp(
    model: nn.Module,
    dataloader: DataLoader,
    optimizer: optim.Optimizer,
    device: torch.device
) -> None:
    """Training with Automatic Mixed Precision."""
    scaler = GradScaler()
    model.train()

    for inputs, targets in dataloader:
        inputs, targets = inputs.to(device), targets.to(device)

        optimizer.zero_grad()

        # Autocast forward pass to FP16
        with autocast():
            outputs = model(inputs)
            loss = nn.functional.cross_entropy(outputs, targets)

        # Backward pass with gradient scaling
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
```

## Distributed Training (DDP)

```python
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data.distributed import DistributedSampler

def setup_ddp(rank: int, world_size: int) -> None:
    """Initialize DDP."""
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

def train_ddp(rank: int, world_size: int) -> None:
    """Distributed training on multiple GPUs."""
    setup_ddp(rank, world_size)

    # Model
    model = ImageClassifier(num_classes=10).to(rank)
    model = DDP(model, device_ids=[rank])

    # DataLoader with DistributedSampler
    dataset = ImageDataset(...)
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank)
    dataloader = DataLoader(dataset, batch_size=32, sampler=sampler)

    optimizer = optim.Adam(model.parameters(), lr=1e-3)

    for epoch in range(num_epochs):
        sampler.set_epoch(epoch)  # Важно для shuffle
        train_epoch(model, dataloader, optimizer, rank)

    dist.destroy_process_group()

# Запуск через torchrun
# torchrun --nproc_per_node=4 train.py
```

## Transfer Learning

```python
from torchvision import models

# Правильно - заморозка backbone, обучение только head
def create_transfer_model(num_classes: int, freeze_backbone: bool = True) -> nn.Module:
    """Create model with pretrained backbone."""
    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V2)

    # Заморозить backbone
    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False

    # Заменить classifier head
    num_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(0.5),
        nn.Linear(num_features, num_classes)
    )

    return model

# Two-stage training: сначала head, потом fine-tune
model = create_transfer_model(num_classes=10, freeze_backbone=True)

# Stage 1: Train only head
optimizer = optim.Adam(model.fc.parameters(), lr=1e-3)
train_model(model, ...)  # 5-10 epochs

# Stage 2: Unfreeze and fine-tune
for param in model.parameters():
    param.requires_grad = True
optimizer = optim.Adam(model.parameters(), lr=1e-5)  # Меньший LR!
train_model(model, ...)  # 10-20 epochs
```

## Gradient Clipping

```python
# Правильно - предотвращение взрывающихся градиентов
def train_step_with_clipping(
    model: nn.Module,
    inputs: torch.Tensor,
    targets: torch.Tensor,
    optimizer: optim.Optimizer,
    max_norm: float = 1.0
) -> torch.Tensor:
    """Training step with gradient clipping."""
    optimizer.zero_grad()
    outputs = model(inputs)
    loss = nn.functional.cross_entropy(outputs, targets)
    loss.backward()

    # Clip gradients by norm
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm)

    optimizer.step()
    return loss
```

## Чеклист Best Practices

- ✅ Type hints everywhere для maintainability
- ✅ Docstrings для публичных методов
- ✅ `pin_memory=True` в DataLoader для GPU
- ✅ Gradient accumulation для больших батчей
- ✅ Mixed precision для 2x speedup
- ✅ Learning rate warmup для стабильности
- ✅ Checkpoint лучшей модели, не последней
- ✅ DistributedSampler для multi-GPU
- ✅ Gradient clipping для RNNs/Transformers
- ✅ Reproducibility: `torch.manual_seed(42)`
