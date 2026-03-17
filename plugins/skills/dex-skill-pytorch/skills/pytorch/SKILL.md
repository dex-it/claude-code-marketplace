---
name: pytorch
description: PyTorch — ловушки training loop, DataLoader, GPU, distributed. Активируется при pytorch, nn.Module, dataloader, training loop, DDP, mixed precision, model.eval, torch.no_grad, optimizer.zero_grad, state_dict, GradScaler, autocast, scheduler, OneCycleLR, pin_memory, checkpoint
---

# PyTorch — ловушки

## Правила

- `model.train()` / `model.eval()` перед каждым этапом — BatchNorm и Dropout ведут себя по-разному
- `torch.no_grad()` при inference — экономит память, без него граф вычислений растёт
- `pin_memory=True` в DataLoader для GPU — ускоряет transfer
- `sampler.set_epoch(epoch)` при DDP — без этого shuffle одинаковый каждую эпоху

## Частые ошибки

| Ошибка | Последствие | Решение |
|--------|-------------|---------|
| Забыл `model.eval()` | Dropout активен при inference, метрики нестабильны | Всегда `model.eval()` + `torch.no_grad()` перед валидацией |
| `loss.backward()` без `optimizer.zero_grad()` | Градиенты накапливаются между батчами | `optimizer.zero_grad()` перед forward pass |
| Checkpoint сохраняет только `model.state_dict()` | Нельзя продолжить обучение (потерян optimizer, epoch) | Сохраняй `model + optimizer + epoch + loss` |
| `num_workers > 0` без `persistent_workers` | Workers пересоздаются каждую эпоху, медленно | `persistent_workers=True` |
| `.item()` внутри training loop | Синхронизация CPU-GPU на каждом батче, тормозит | Накапливай tensor, `.item()` только для логов |
| `model.to(device)` после DDP wrap | DDP уже привязал к device, повторный to() ломает | `model.to(rank)` ДО `DDP(model)` |
| `torch.save(model)` вместо `state_dict()` | Pickle сохраняет структуру класса, ломается при рефакторинге | `torch.save(model.state_dict())` |

## Scheduler — где вызывать step()

```
Плохо:
  scheduler = OneCycleLR(...)
  for epoch:
      train(...)
      scheduler.step()  # OneCycleLR — per-batch, не per-epoch!
  // LR schedule сломан, модель не сходится

Хорошо:
  Per-batch schedulers (OneCycleLR, CosineAnnealingWarmRestarts):
      scheduler.step() после каждого optimizer.step()

  Per-epoch schedulers (ReduceLROnPlateau, StepLR, CosineAnnealingLR):
      scheduler.step() после валидации
```

## DataLoader ловушки

```
Плохо:
  DataLoader(dataset, shuffle=True, sampler=my_sampler)
  // shuffle и sampler взаимоисключающие — RuntimeError

Плохо:
  def __getitem__(self, idx):
      image = cv2.imread(self.paths[idx])  # BGR!
      transform = transforms.Normalize(...)  # Ожидает RGB
  // Цвета перепутаны, модель учит мусор

Плохо:
  DataLoader(dataset, num_workers=16, batch_size=2)
  // 16 workers на batch_size=2 — overhead > benefit
  // Правило: num_workers примерно 4 * num_gpus
```

## Mixed Precision ловушки

```
Плохо:
  scaler = GradScaler()
  with autocast():
      loss = model(x)
      loss.backward()  # backward внутри autocast!
  // Gradient computation должен быть вне autocast

Хорошо:
  with autocast():
      loss = model(x)
  scaler.scale(loss).backward()  # backward вне autocast
  scaler.step(optimizer)
  scaler.update()
```

## DDP ловушки

```
Плохо:
  model = DDP(model)
  torch.save(model.state_dict())
  // Ключи имеют prefix "module." — не загрузится в обычную модель

Хорошо:
  torch.save(model.module.state_dict())
  // Или при загрузке: убрать "module." prefix

Плохо:
  if rank == 0:
      loss = special_loss(...)  # Только на rank 0
  loss.backward()
  // Deadlock — остальные ranks ждут gradient sync

Правило:
  Forward/backward path должен быть ИДЕНТИЧЕН на всех ranks
  Условная логика (logging, saving) — только вне gradient computation
```

## Чек-лист

- [ ] `model.eval()` + `torch.no_grad()` при inference
- [ ] `optimizer.zero_grad()` перед каждым forward
- [ ] Checkpoint: model + optimizer + epoch + scheduler
- [ ] Scheduler.step() в правильном месте (per-batch vs per-epoch)
- [ ] DataLoader: num_workers разумный, pin_memory=True
- [ ] DDP: `set_epoch()`, save `model.module.state_dict()`
- [ ] Нет `.item()` в tight loop — только для логов
