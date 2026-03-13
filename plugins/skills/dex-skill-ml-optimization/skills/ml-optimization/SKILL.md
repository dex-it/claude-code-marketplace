---
name: ml-optimization
description: ML optimization — ловушки hyperparameter tuning, distributed training, profiling. Активируется при optuna, ray tune, hyperparameter, distributed training, profiling, optimization
allowed-tools: Read, Grep, Glob
---

# ML Optimization — ловушки

## Hyperparameter Tuning

### GridSearch для >4 параметров
Плохо: `GridSearchCV` с 6 параметрами → `3^6 = 729` trials, большинство бесполезны
Правильно: Optuna (TPE sampler) или `RandomizedSearchCV` — находят хорошие зоны быстрее
Почему: grid тратит равное время на все комбинации. TPE фокусируется на перспективных зонах

### Без pruning — 80% trials тратят время зря
Плохо: `study.optimize(objective, n_trials=100)` — все 100 trials бегут до конца
Правильно: `pruner=MedianPruner(n_warmup_steps=2)` + `trial.report()` + `trial.should_prune()`
Почему: trial с loss=10.0 после 1 epoch продолжает ещё 49 epochs. Pruning останавливает плохие trials рано

### Линейный sampling для LR
Плохо: `trial.suggest_float('lr', 0.0001, 0.1)` — 90% trials в [0.01, 0.1]
Правильно: `trial.suggest_float('lr', 1e-5, 1e-2, log=True)` — равномерно по порядкам величин
Почему: LR 1e-4 и 1e-3 различаются на порядок. Линейный sampling почти никогда не попадёт в 1e-4

### Слишком гранулярный int search
Плохо: `trial.suggest_int('hidden_dim', 10, 1000)` — 990 вариантов, разница между 437 и 438 = шум
Правильно: `trial.suggest_categorical('hidden_dim', [64, 128, 256, 512, 1024])` — meaningful choices
Почему: гранулярный int space раздувает пространство поиска без пользы

### Tuning на train metric
Плохо: `study.optimize` по train accuracy → параметры overfit к train data
Правильно: всегда optimize val/test metric
Почему: train metric всегда растёт с complexity. Без val metric выберешь самый переобученный вариант

## Distributed Training

### DDP без масштабирования LR
Плохо: `batch_size=32, lr=1e-3` на 1 GPU → те же настройки на 4 GPU
Правильно: linear scaling rule: `lr × num_gpus` или тот же LR с длинным warmup
Почему: effective batch = 32×4 = 128. Тот же LR для большего batch → underfitting, не сходится

### Logging на всех ranks
Плохо: `print(f"Loss: {loss}")` → 4 GPU = 4 одинаковых print
Правильно: `if dist.get_rank() == 0:` для logging, saving, validation
Почему: логи загрязнены дубликатами, checkpoint сохраняется 4 раза, validation считается 4 раза

### DataLoader без DistributedSampler
Плохо: `DataLoader(dataset, shuffle=True)` с DDP → каждый GPU видит весь dataset
Правильно: `DistributedSampler(dataset)` + `shuffle=False` + `sampler.set_epoch(epoch)` каждую эпоху
Почему: без sampler каждый GPU обрабатывает те же данные = 4x duplicate work, не speedup

## Profiling

### Профилирование всего training run
Плохо: `with profile(): for epoch in range(100): train()` — гигабайты trace
Правильно: профилировать 5-10 батчей: `for i, batch in enumerate(loader): if i >= 10: break`
Почему: bottleneck виден за 5 батчей. 100 эпох profiling = unusable trace file

### GPU utilization ≠ efficiency
Плохо: "GPU utilization 99%" → "всё оптимизировано"
Правильно: смотри SM occupancy, memory throughput, kernel launch overhead
Почему: GPU может быть busy на мелких kernels с простоями между ними. High utilization ≠ high throughput

### Оптимизация model forward когда bottleneck в data loading
Плохо: оптимизируешь модель, но `torch.profiler` показывает 60% времени в DataLoader
Правильно: увеличить `num_workers`, `prefetch_factor`, `pin_memory=True`, `persistent_workers=True`
Почему: profile ПЕРЕД оптимизацией. Если bottleneck в I/O — любая оптимизация модели бесполезна

## Memory Optimization

| Проблема | Решение | Trade-off |
|----------|---------|-----------|
| OOM training | Gradient checkpointing | -20% speed, -60% memory |
| OOM training | Меньший batch + gradient accumulation | Equivalent math, чуть медленнее |
| OOM inference | `torch.no_grad()` | Бесплатно, всегда делай |
| OOM inference | Mixed precision (FP16/BF16) | -50% memory, ~бесплатно |
| OOM fine-tuning LLM | QLoRA (4-bit + LoRA) | Чуть ниже quality, -75% memory |
| Модель > 1 GPU | Model parallelism / FSDP | Сложная настройка |

### Gradient accumulation без scale
Плохо: `loss.backward()` каждый micro-batch, `optimizer.step()` каждые N шагов, но loss не делится на N
Правильно: `loss = loss / accumulation_steps` перед backward
Почему: без деления эффективный loss = N × реальный loss → LR фактически в N раз больше → нестабильность

## torch.compile

### torch.compile + динамический control flow
Плохо: `model = torch.compile(model)` + `if random_condition(): model.special_forward(data)` → recompilation
Правильно: torch.compile для статичного computation graph. Динамические ветки выносить за compiled функцию
Почему: каждый новый путь = recompilation (минуты). Динамический flow → compile медленнее чем без него

### max-autotune для всего
Плохо: `torch.compile(model, mode='max-autotune')` — первый вызов 5-10 минут
Правильно: `mode='default'` для начала, `'reduce-overhead'` для inference, `'max-autotune'` только для long training
Почему: max-autotune перебирает все kernel варианты. Для inference или коротких задач — compilation > execution time

## Чек-лист

- Profile → найти bottleneck → оптимизировать (не наоборот)
- Optuna: `log=True` для LR/weight_decay, pruner включён
- DDP: LR scaled, logging на rank 0, DistributedSampler
- Gradient accumulation: `loss / accumulation_steps`
- Mixed precision (AMP) включён для GPU training
- `torch.no_grad()` при inference
- torch.compile для статичного графа, `mode='default'` для начала
