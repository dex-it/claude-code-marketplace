---
name: pytorch
description: PyTorch — ловушки training loop, DataLoader, GPU. Активируется при pytorch, nn.Module, dataloader, DDP, mixed precision, model.eval, torch.no_grad, optimizer.zero_grad, state_dict, GradScaler, autocast, checkpoint
---

# PyTorch — ловушки

## Training Loop

### model.eval() забыт при inference
Плохо: `model(val_input)` без вызова `model.eval()` — BatchNorm и Dropout остаются в train mode
Правильно: `model.eval()` + `torch.no_grad()` перед валидацией/inference
Почему: Dropout отбрасывает нейроны, BatchNorm использует batch statistics вместо running — метрики нестабильны

### optimizer.zero_grad() пропущен
Плохо: `loss.backward()` без `optimizer.zero_grad()` перед forward pass
Правильно: `optimizer.zero_grad()` -> forward -> `loss.backward()` -> `optimizer.step()`
Почему: градиенты накапливаются между батчами, модель обновляется по сумме всех предыдущих градиентов

### torch.no_grad() забыт при inference
Плохо: `predictions = model(test_data)` — граф вычислений строится, память тратится
Правильно: `with torch.no_grad(): predictions = model(test_data)`
Почему: без no_grad PyTorch хранит промежуточные тензоры для backward — OOM на больших батчах

### .item() внутри training loop
Плохо: `total_loss += loss.item()` на каждом батче — синхронизация CPU-GPU
Правильно: накапливай tensor, `.item()` только для логирования (раз в N батчей)
Почему: .item() вызывает cuda synchronize, GPU простаивает пока CPU читает значение

## Checkpoint

### Сохранение только model.state_dict()
Плохо: `torch.save(model.state_dict(), path)` — нельзя продолжить обучение
Правильно: сохраняй `model + optimizer + epoch + scheduler state_dict` вместе
Почему: без optimizer state (momentum, LR) обучение начинается фактически заново, метрики проседают

### torch.save(model) вместо state_dict()
Плохо: `torch.save(model, path)` — pickle сохраняет структуру класса
Правильно: `torch.save(model.state_dict(), path)` + загрузка через `model.load_state_dict()`
Почему: при рефакторинге класса (переименование, перемещение) pickle ломается — модель не загружается

## Scheduler

### OneCycleLR step() per-epoch вместо per-batch
Плохо: `scheduler.step()` после эпохи для OneCycleLR — LR schedule сломан
Правильно: per-batch schedulers (OneCycleLR, CosineAnnealingWarmRestarts) — `step()` после каждого `optimizer.step()`
Почему: OneCycleLR рассчитан на total_steps = epochs * batches_per_epoch. Per-epoch step = LR меняется в N раз медленнее

### ReduceLROnPlateau step() без метрики
Плохо: `scheduler.step()` без аргумента для ReduceLROnPlateau
Правильно: `scheduler.step(val_loss)` — передавай метрику для мониторинга
Почему: scheduler не знает когда снижать LR без метрики, LR никогда не изменится

## DataLoader

### shuffle и sampler одновременно
Плохо: `DataLoader(dataset, shuffle=True, sampler=my_sampler)` — RuntimeError
Правильно: используй либо `shuffle=True`, либо custom `sampler`, не оба
Почему: shuffle и sampler оба контролируют порядок данных — взаимоисключающие параметры

### num_workers без persistent_workers
Плохо: `DataLoader(dataset, num_workers=8)` без `persistent_workers=True`
Правильно: `DataLoader(dataset, num_workers=4, persistent_workers=True, pin_memory=True)`
Почему: без persistent_workers воркеры пересоздаются каждую эпоху. Overhead инициализации > экономия параллелизма

### BGR не конвертирован в RGB
Плохо: `cv2.imread(path)` -> `transforms.Normalize(mean=[0.485...])` — ImageNet нормализация на BGR
Правильно: `cv2.cvtColor(img, cv2.COLOR_BGR2RGB)` перед transform
Почему: OpenCV читает BGR, PyTorch/torchvision ожидает RGB. Перепутанные каналы = модель учит мусор

## Mixed Precision

### backward() внутри autocast
Плохо: `with autocast(): loss = model(x); loss.backward()` — backward внутри autocast контекста
Правильно: `with autocast(): loss = model(x)` затем `scaler.scale(loss).backward()` вне autocast
Почему: gradient computation в mixed precision может давать numerical instability. backward должен быть вне autocast

## DDP (Distributed)

### state_dict с prefix "module."
Плохо: `torch.save(model.state_dict(), path)` после DDP wrap — ключи с prefix `module.`
Правильно: `torch.save(model.module.state_dict(), path)` — сохраняй unwrapped модель
Почему: state_dict с `module.` prefix не загрузится в обычную модель без DDP. Нужен ручной strip prefix

### Разная логика на разных ranks
Плохо: `if rank == 0: loss = special_loss(...)` -> `loss.backward()` — deadlock
Правильно: forward/backward path идентичен на всех ranks. Условная логика только для logging/saving
Почему: DDP синхронизирует градиенты между ranks. Если forward path отличается — ranks ждут друг друга бесконечно

### set_epoch() забыт для DistributedSampler
Плохо: `DistributedSampler` без `sampler.set_epoch(epoch)` в цикле обучения
Правильно: `sampler.set_epoch(epoch)` перед каждой эпохой
Почему: без set_epoch shuffle одинаковый каждую эпоху — модель видит данные в одном порядке, хуже generalization

## Чек-лист

- model.eval() + torch.no_grad() при inference
- optimizer.zero_grad() перед каждым forward
- Checkpoint: model + optimizer + epoch + scheduler
- Scheduler.step() в правильном месте (per-batch vs per-epoch)
- DataLoader: num_workers разумный, pin_memory=True, persistent_workers
- DDP: set_epoch(), save model.module.state_dict()
- Нет .item() в tight loop — только для логов
