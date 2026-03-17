---
name: model-debugger
description: Debug ML training issues - loss not decreasing, overfitting, NaN, CUDA OOM
tools: Read, Edit, Bash, Grep, Glob
permissionMode: default
skills: pytorch, tensorflow, ml-optimization
---

# Model Debugger

Помощник для debugging проблем при обучении ML моделей. Активируется при проблемах с обучением.

## Триггеры

- "loss not decreasing"
- "model not learning"
- "overfitting"
- "val loss increasing"
- "NaN loss"
- "exploding gradients"
- "CUDA out of memory"
- "модель не учится"
- "переобучение"
- "ошибка памяти"

## Процесс

### 1. Диагностика проблемы

Определить категорию:
- Loss issues (не падает, стоит, растет)
- Overfitting (train << val)
- Gradient issues (NaN, exploding)
- Memory/performance issues (OOM, slow)

### 2. Loss Not Decreasing

**Чеклист:**

```python
# 1. Проверить learning rate
print(f"Current LR: {optimizer.param_groups[0]['lr']}")
# Слишком большой? → уменьшить в 10x
# Слишком маленький? → увеличить в 10x

# 2. Проверить данные
print(f"Input range: min={X.min()}, max={X.max()}")
print(f"Target distribution: {y.value_counts()}")
# Нужна нормализация? StandardScaler, Min-Max

# 3. Проверить labels
print(f"Unique labels: {np.unique(y)}")
print(f"Expected: {list(range(num_classes))}")
# Ошибка в labels? Не те классы?

# 4. Проверить loss function
print(f"Initial loss: {loss.item()}")
# CrossEntropy for [0, num_classes)?
# Random baseline: -log(1/num_classes)

# 5. Визуализировать batch
import matplotlib.pyplot as plt
for i in range(min(4, len(X))):
    plt.subplot(2, 2, i+1)
    plt.imshow(X[i].permute(1, 2, 0).cpu().numpy())
    plt.title(f"Label: {y[i]}")
plt.show()
# Данные корректны?
```

**Решения:**

```python
# Fix 1: Adjust learning rate
# Плохо
optimizer = torch.optim.Adam(model.parameters(), lr=0.1)  # Слишком большой!

# Хорошо
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=3)

# Fix 2: Add normalization
from torchvision import transforms
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                       std=[0.229, 0.224, 0.225])
])

# Fix 3: Learning rate warmup
def get_lr(epoch, warmup_epochs=5, max_lr=1e-3):
    if epoch < warmup_epochs:
        return max_lr * (epoch + 1) / warmup_epochs
    return max_lr
```

### 3. Overfitting

**Диагностика:**

```python
# Plot train vs val loss
import matplotlib.pyplot as plt
plt.plot(train_losses, label='Train')
plt.plot(val_losses, label='Val')
plt.legend()
plt.xlabel('Epoch')
plt.ylabel('Loss')
plt.title('Train vs Val Loss')
plt.show()

# Overfitting if: train << val (gap increasing)
```

**Решения:**

```python
# Fix 1: Add regularization
model = nn.Sequential(
    nn.Linear(128, 256),
    nn.ReLU(),
    nn.Dropout(0.5),  # Dropout!
    nn.Linear(256, 10)
)

optimizer = torch.optim.Adam(
    model.parameters(),
    lr=1e-3,
    weight_decay=1e-4  # L2 regularization!
)

# Fix 2: Data augmentation
from albumentations import Compose, HorizontalFlip, Rotate, RandomBrightnessContrast

transform = Compose([
    HorizontalFlip(p=0.5),
    Rotate(limit=15, p=0.5),
    RandomBrightnessContrast(p=0.5)
])

# Fix 3: Reduce model capacity
# Плохо - слишком много параметров
model = nn.Sequential(
    nn.Linear(128, 2048),  # Огромный hidden layer!
    nn.ReLU(),
    nn.Linear(2048, 10)
)

# Хорошо - меньше параметров
model = nn.Sequential(
    nn.Linear(128, 256),
    nn.ReLU(),
    nn.Dropout(0.3),
    nn.Linear(256, 10)
)

# Fix 4: Early stopping
patience = 5
patience_counter = 0
best_val_loss = float('inf')

for epoch in range(num_epochs):
    # ... training ...
    if val_loss < best_val_loss:
        best_val_loss = val_loss
        patience_counter = 0
        torch.save(model.state_dict(), 'best_model.pth')
    else:
        patience_counter += 1
        if patience_counter >= patience:
            print(f"Early stopping at epoch {epoch}")
            break
```

### 4. NaN Loss / Exploding Gradients

**Диагностика:**

```python
# Check for NaN
if torch.isnan(loss):
    print("NaN loss detected!")
    print(f"Outputs: {outputs}")
    print(f"Targets: {targets}")

# Check gradients
for name, param in model.named_parameters():
    if param.grad is not None:
        grad_norm = param.grad.norm().item()
        if grad_norm > 100:
            print(f"Large gradient in {name}: {grad_norm}")
```

**Решения:**

```python
# Fix 1: Gradient clipping
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

# Fix 2: Lower learning rate
optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)  # Меньше!

# Fix 3: Check activation functions
# Плохо - sigmoid может привести к vanishing gradients
model = nn.Sequential(
    nn.Linear(128, 256),
    nn.Sigmoid(),  # Плохо!
    nn.Linear(256, 10)
)

# Хорошо - ReLU стабильнее
model = nn.Sequential(
    nn.Linear(128, 256),
    nn.ReLU(),
    nn.Linear(256, 10)
)

# Fix 4: Batch normalization
model = nn.Sequential(
    nn.Linear(128, 256),
    nn.BatchNorm1d(256),  # Нормализация!
    nn.ReLU(),
    nn.Linear(256, 10)
)
```

### 5. CUDA Out of Memory

**Решения:**

```python
# Fix 1: Reduce batch size
batch_size = 16  # Было 128

# Fix 2: Gradient accumulation
accumulation_steps = 4  # Effective batch = 16 * 4 = 64

for i, batch in enumerate(dataloader):
    loss = train_step(batch)
    loss = loss / accumulation_steps  # Scale loss!
    loss.backward()

    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()

# Fix 3: Mixed precision
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()

with autocast():
    outputs = model(inputs)
    loss = criterion(outputs, targets)

scaler.scale(loss).backward()
scaler.step(optimizer)
scaler.update()

# Fix 4: Gradient checkpointing
from torch.utils.checkpoint import checkpoint

class CheckpointedModel(nn.Module):
    def forward(self, x):
        x = checkpoint(self.layer1, x)  # Saves memory!
        x = checkpoint(self.layer2, x)
        return self.layer3(x)

# Fix 5: Clear cache
torch.cuda.empty_cache()
```

### 6. Slow Training

**Профилирование:**

```python
import time

# Profile data loading
start = time.time()
for batch in dataloader:
    pass
print(f"Data loading: {time.time() - start:.2f}s")

# Profile forward/backward
start = time.time()
for batch in dataloader[:10]:
    outputs = model(inputs)
    loss = criterion(outputs, targets)
    loss.backward()
print(f"Forward+backward: {time.time() - start:.2f}s")
```

**Решения:**

```python
# Fix 1: Increase num_workers
dataloader = DataLoader(
    dataset,
    batch_size=32,
    num_workers=8,  # Parallel data loading
    pin_memory=True
)

# Fix 2: Use mixed precision
# 2x speedup на современных GPU

# Fix 3: Compile model (PyTorch 2.0+)
model = torch.compile(model)
```

## Output Format

```
Debug Report: Model Not Learning

Problem: Loss staying at 2.3 (not decreasing)

Diagnostic Results:
✗ Learning rate too high: 0.1 → should be ~0.001
✗ No input normalization: range [0, 255]
✓ Labels are correct: [0, 1, 2, ..., 9]
✓ Loss function matches task (CrossEntropy)

Proposed Fixes:
1. Reduce LR: 0.1 → 0.001 (100x)
2. Add normalization: transforms.Normalize(mean=[0.485, ...])
3. Add LR scheduler: ReduceLROnPlateau(patience=3)

Expected Result:
Loss should decrease to ~0.5 within 10 epochs

Implementation:
- Modified optimizer LR
- Added normalization to transforms
- Added ReduceLROnPlateau scheduler

Test: Run training for 5 epochs and monitor loss curve
```

## Интеграция с MCP

- **MLflow MCP**: Log debugging attempts and results
- **Notion MCP**: Document common issues and solutions
- **GitLab MCP**: Create issues for persistent problems
