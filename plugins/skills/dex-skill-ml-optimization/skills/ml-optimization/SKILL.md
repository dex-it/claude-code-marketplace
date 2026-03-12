---
name: ml-optimization
description: ML optimization — ловушки hyperparameter tuning, distributed training, profiling. Активируется при optuna, ray tune, hyperparameter, distributed training, profiling, optimization
allowed-tools: Read, Grep, Glob
---

# ML Optimization — ловушки

## Правила

- Profile ПЕРЕД оптимизацией — не оптимизируй то, что не является bottleneck
- Pruning (MedianPruner, ASHA) обязателен — без него 80% trials тратят время зря
- Gradient checkpointing = 3x меньше memory, ~20% медленнее — trade-off, не бесплатно
- `torch.compile()` (PyTorch 2.0+) — бесплатный 20-30% speedup, но первый запуск долгий

## Hyperparameter Tuning ловушки

| Ошибка | Последствие | Решение |
|--------|-------------|---------|
| GridSearch для >4 параметров | Комбинаторный взрыв (3^6 = 729 trials) | RandomizedSearch или Optuna (TPE sampler) |
| Нет pruning | 100 trials по 30 мин = 50 часов, 80% бесполезны | `MedianPruner(n_warmup_steps=2)` |
| `n_trials=10` | Слишком мало для поиска в 5D пространстве | Минимум 50-100 trials с pruning |
| Tuning на train metric | Параметры overfit к train data | Всегда optimize val metric |
| Одинаковый seed для всех trials | Optuna sampler не видит вариативность | `seed` только для reproducibility study, не для sampler |

```
Плохо:
  study = optuna.create_study()
  study.optimize(objective, n_trials=100)
  // Без pruner: все 100 trials бегут до конца
  // Trial с loss=10.0 после 1 epoch продолжает ещё 49 epochs

Хорошо:
  study = optuna.create_study(
      pruner=optuna.pruners.MedianPruner(n_warmup_steps=2)
  )
  # В objective:
  for epoch in range(50):
      val_loss = train_and_validate()
      trial.report(val_loss, epoch)
      if trial.should_prune():
          raise optuna.TrialPruned()
  // Плохие trials останавливаются после 2-3 epochs
```

## Search Space ошибки

```
Плохо:
  lr = trial.suggest_float('lr', 0.0001, 0.1)
  // Линейный sampling: 90% trials будут в [0.01, 0.1]
  // LR 0.0001 и 0.001 одинаково редки

Хорошо:
  lr = trial.suggest_float('lr', 1e-5, 1e-2, log=True)
  // Log-uniform: равномерно по порядкам величин
  // Используй log=True для LR, weight_decay, любых >2 порядков

Плохо:
  hidden_dim = trial.suggest_int('hidden_dim', 10, 1000)
  // 990 вариантов — слишком гранулярно
  // Разница между hidden_dim=437 и 438 — шум

Хорошо:
  hidden_dim = trial.suggest_categorical('hidden_dim', [64, 128, 256, 512, 1024])
  // Meaningful discrete choices
```

## Distributed Training ловушки

```
Плохо:
  # DDP с batch_size=32 на 4 GPU
  // Effective batch = 32 * 4 = 128
  // Но LR тот же что для batch=32 → underfitting

Правило:
  Linear scaling rule: LR × num_gpus
  batch_size=32, lr=1e-3 на 1 GPU
  → batch_size=32, lr=4e-3 на 4 GPU (или lr=1e-3, warmup дольше)

Плохо:
  # DDP: logging на всех ranks
  print(f"Loss: {loss.item()}")
  // 4 GPU = 4 одинаковых print

Хорошо:
  if dist.get_rank() == 0:
      print(f"Loss: {loss.item()}")
  // Logging, saving, validation — только на rank 0

Плохо:
  # DataLoader без DistributedSampler
  DataLoader(dataset, shuffle=True)
  // Каждый GPU видит ВЕСЬ dataset → 4x duplicate work

Хорошо:
  sampler = DistributedSampler(dataset)
  DataLoader(dataset, sampler=sampler)  # shuffle=False (sampler делает shuffle)
  # sampler.set_epoch(epoch) в начале каждой эпохи!
```

## Profiling ловушки

```
Плохо:
  # Профилировать весь training run
  with profile():
      for epoch in range(100):
          train(...)
  // Гигабайты trace, невозможно анализировать

Хорошо:
  # Профилировать 5-10 батчей
  with profile(activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA]) as prof:
      for i, batch in enumerate(dataloader):
          if i >= 10: break
          train_step(batch)

Плохо:
  # "GPU utilization 99%" → "всё оптимизировано"
  // GPU может быть busy, но на мелких kernel'ах с простоями между ними
  // Смотри: GPU SM occupancy, memory throughput, не просто utilization

Плохо:
  # Оптимизировать model forward, когда bottleneck — data loading
  // torch.profiler покажет, что 60% времени — DataLoader
  // Решение: увеличить num_workers, prefetch_factor
```

## Memory optimization выбор

| Проблема | Решение | Trade-off |
|----------|---------|-----------|
| OOM при training | Gradient checkpointing | -20% speed, -60% memory |
| OOM при training | Reduce batch_size + gradient accumulation | Equivalent, чуть медленнее |
| OOM при inference | `torch.no_grad()` | Бесплатно, всегда делай |
| OOM при inference | Mixed precision (FP16/BF16) | -50% memory, ~бесплатно |
| OOM при fine-tuning LLM | QLoRA (4-bit + LoRA) | Чуть ниже quality, -75% memory |
| Модель не влезает на 1 GPU | Model parallelism / FSDP | Сложная настройка |

## torch.compile ловушки

```
Плохо:
  model = torch.compile(model, mode='max-autotune')
  output = model(first_batch)  # Компиляция 5-10 минут!
  // Первый вызов = compilation, не inference

Плохо:
  model = torch.compile(model)
  for data in dataloader:
      if random_condition():
          output = model.special_forward(data)  # Recompilation!
      else:
          output = model(data)
  // Динамические control flow → recompilation каждый раз
  // torch.compile хорош для статичного computation graph

Правило:
  mode='default' для начала
  mode='reduce-overhead' для inference
  mode='max-autotune' только когда compilation time не важен
```

## Чек-лист

- [ ] Profile → найти bottleneck → оптимизировать (не наоборот)
- [ ] Optuna: `log=True` для LR/weight_decay, pruner включён
- [ ] DDP: LR scaled, logging на rank 0, DistributedSampler
- [ ] Gradient accumulation для эффективного большого batch
- [ ] Mixed precision (AMP) включён для GPU training
- [ ] `torch.no_grad()` при inference
- [ ] torch.compile для PyTorch 2.0+ (статичный граф)
