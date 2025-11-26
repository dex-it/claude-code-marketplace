---
name: ml-optimization
description: ML optimization - hyperparameter tuning with Optuna/Ray Tune, distributed training, profiling. Активируется при optuna, ray tune, hyperparameter, distributed training, profiling, optimization
allowed-tools: Read, Grep, Glob
---

# ML Optimization

## Hyperparameter Tuning с Optuna

### Правильное использование Optuna

```python
from typing import Dict, Any
import optuna
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

# Правильно - objective function с trial
def objective(trial: optuna.Trial) -> float:
    """Optuna objective function."""
    # Suggest hyperparameters
    lr = trial.suggest_float('lr', 1e-5, 1e-2, log=True)
    batch_size = trial.suggest_categorical('batch_size', [16, 32, 64, 128])
    num_layers = trial.suggest_int('num_layers', 2, 5)
    hidden_dim = trial.suggest_categorical('hidden_dim', [128, 256, 512])
    dropout = trial.suggest_float('dropout', 0.1, 0.5)
    weight_decay = trial.suggest_float('weight_decay', 1e-6, 1e-3, log=True)

    # Create model with suggested params
    model = create_model(num_layers, hidden_dim, dropout)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)

    # Create dataloader with suggested batch_size
    train_loader = create_dataloader(batch_size=batch_size)
    val_loader = create_dataloader(batch_size=batch_size, shuffle=False)

    # Train for few epochs
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model.to(device)

    for epoch in range(5):  # Quick training для каждого trial
        train_epoch(model, train_loader, optimizer, device)

        # Validate
        val_loss = validate(model, val_loader, device)

        # Report intermediate value для pruning
        trial.report(val_loss, epoch)

        # Handle pruning
        if trial.should_prune():
            raise optuna.TrialPruned()

    return val_loss

# Run optimization
def optimize_hyperparameters(n_trials: int = 100) -> Dict[str, Any]:
    """Optimize hyperparameters with Optuna."""
    # Create study
    study = optuna.create_study(
        direction='minimize',  # Minimize val_loss
        pruner=optuna.pruners.MedianPruner(n_warmup_steps=2),  # Prune bad trials
        sampler=optuna.samplers.TPESampler(seed=42)
    )

    # Optimize
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    # Results
    print(f"Best trial: {study.best_trial.number}")
    print(f"Best value: {study.best_value:.4f}")
    print(f"Best params: {study.best_params}")

    # Plot optimization history
    optuna.visualization.plot_optimization_history(study).show()
    optuna.visualization.plot_param_importances(study).show()

    return study.best_params

# Multi-objective optimization
def multi_objective_optimization():
    """Optimize multiple objectives (e.g., accuracy and latency)."""
    def objective_multi(trial):
        # ... create model ...
        accuracy = evaluate_accuracy(model)
        latency = measure_latency(model)

        return accuracy, latency  # Return tuple

    study = optuna.create_study(
        directions=['maximize', 'minimize']  # Max accuracy, min latency
    )
    study.optimize(objective_multi, n_trials=100)

    # Pareto front
    print("Pareto optimal trials:")
    for trial in study.best_trials:
        print(f"Trial {trial.number}: accuracy={trial.values[0]:.4f}, latency={trial.values[1]:.4f}ms")
```

## Ray Tune для Distributed Tuning

```python
from ray import tune
from ray.tune.schedulers import ASHAScheduler
from ray.tune import CLIReporter

# Правильно - Ray Tune с ASHA scheduler
def train_model_ray(config: Dict[str, Any]) -> None:
    """Training function для Ray Tune."""
    model = create_model(config)
    optimizer = torch.optim.Adam(model.parameters(), lr=config['lr'])

    for epoch in range(config['num_epochs']):
        train_loss = train_epoch(model, optimizer)
        val_acc = validate(model)

        # Report metrics
        tune.report(loss=train_loss, accuracy=val_acc)

def ray_tune_optimization():
    """Distributed hyperparameter search with Ray Tune."""
    # Search space
    config = {
        'lr': tune.loguniform(1e-5, 1e-2),
        'batch_size': tune.choice([16, 32, 64, 128]),
        'hidden_dim': tune.choice([128, 256, 512]),
        'num_epochs': 10
    }

    # ASHA scheduler - early stopping для bad trials
    scheduler = ASHAScheduler(
        metric='accuracy',
        mode='max',
        max_t=10,  # Max epochs
        grace_period=2,  # Min epochs before stopping
        reduction_factor=2
    )

    # Reporter
    reporter = CLIReporter(
        metric_columns=['loss', 'accuracy', 'training_iteration']
    )

    # Run tuning
    result = tune.run(
        train_model_ray,
        config=config,
        num_samples=100,  # Number of trials
        scheduler=scheduler,
        progress_reporter=reporter,
        resources_per_trial={'cpu': 2, 'gpu': 0.5}  # Parallel trials on 1 GPU
    )

    # Best config
    best_trial = result.get_best_trial('accuracy', 'max', 'last')
    print(f"Best config: {best_trial.config}")
    print(f"Best accuracy: {best_trial.last_result['accuracy']:.4f}")
```

## Distributed Training с PyTorch DDP

### Multi-GPU Training

```python
import torch.distributed as dist
import torch.multiprocessing as mp
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data.distributed import DistributedSampler

def setup_ddp(rank: int, world_size: int) -> None:
    """Initialize DDP process group."""
    dist.init_process_group(
        backend='nccl',  # NCCL для GPU
        init_method='env://',
        rank=rank,
        world_size=world_size
    )
    torch.cuda.set_device(rank)

def cleanup_ddp():
    """Cleanup DDP."""
    dist.destroy_process_group()

def train_ddp(rank: int, world_size: int, config: Dict[str, Any]) -> None:
    """Training on single GPU process."""
    setup_ddp(rank, world_size)

    # Create model and wrap with DDP
    model = create_model(config).to(rank)
    model = DDP(model, device_ids=[rank])

    # Create distributed dataloader
    dataset = create_dataset()
    sampler = DistributedSampler(
        dataset,
        num_replicas=world_size,
        rank=rank,
        shuffle=True
    )
    dataloader = DataLoader(
        dataset,
        batch_size=config['batch_size'],
        sampler=sampler,
        num_workers=4,
        pin_memory=True
    )

    # Training loop
    optimizer = torch.optim.Adam(model.parameters(), lr=config['lr'])

    for epoch in range(config['num_epochs']):
        # Important: set epoch для shuffle
        sampler.set_epoch(epoch)

        model.train()
        for batch in dataloader:
            inputs, targets = batch
            inputs, targets = inputs.to(rank), targets.to(rank)

            optimizer.zero_grad()
            outputs = model(inputs)
            loss = nn.functional.cross_entropy(outputs, targets)
            loss.backward()
            optimizer.step()

        # Synchronize metrics across processes
        if rank == 0:  # Only master process prints
            print(f"Epoch {epoch}: loss={loss.item():.4f}")

    cleanup_ddp()

# Launch training
def main():
    world_size = torch.cuda.device_count()
    mp.spawn(
        train_ddp,
        args=(world_size, config),
        nprocs=world_size,
        join=True
    )

# Or use torchrun:
# torchrun --nproc_per_node=4 train.py
```

## Performance Profiling

### PyTorch Profiler

```python
from torch.profiler import profile, record_function, ProfilerActivity

def profile_model(model: nn.Module, dataloader: DataLoader, device: torch.device):
    """Profile model training."""
    model.train()

    with profile(
        activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
        record_shapes=True,
        profile_memory=True,
        with_stack=True
    ) as prof:
        with record_function("training_step"):
            for batch_idx, (inputs, targets) in enumerate(dataloader):
                if batch_idx >= 10:  # Profile только 10 batches
                    break

                inputs, targets = inputs.to(device), targets.to(device)

                with record_function("forward"):
                    outputs = model(inputs)
                    loss = nn.functional.cross_entropy(outputs, targets)

                with record_function("backward"):
                    loss.backward()

                with record_function("optimizer_step"):
                    optimizer.step()
                    optimizer.zero_grad()

    # Print summary
    print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=10))

    # Export to Chrome trace
    prof.export_chrome_trace("trace.json")
    # Open in chrome://tracing
```

### Memory Profiling

```python
import torch

def profile_memory(model: nn.Module, input_shape: tuple):
    """Profile GPU memory usage."""
    device = torch.device('cuda')
    model.to(device)

    # Reset peak memory stats
    torch.cuda.reset_peak_memory_stats(device)
    torch.cuda.empty_cache()

    # Forward pass
    dummy_input = torch.randn(*input_shape).to(device)
    with torch.no_grad():
        output = model(dummy_input)

    # Memory stats
    allocated = torch.cuda.memory_allocated(device) / 1024**2  # MB
    reserved = torch.cuda.memory_reserved(device) / 1024**2
    peak = torch.cuda.max_memory_allocated(device) / 1024**2

    print(f"Allocated: {allocated:.2f} MB")
    print(f"Reserved: {reserved:.2f} MB")
    print(f"Peak: {peak:.2f} MB")

    # Detailed summary
    print(torch.cuda.memory_summary(device))
```

## Optimization Tricks

### Gradient Checkpointing

```python
from torch.utils.checkpoint import checkpoint

# Правильно - gradient checkpointing для больших моделей
class CheckpointedModel(nn.Module):
    """Model with gradient checkpointing."""

    def __init__(self):
        super().__init__()
        self.layer1 = nn.Linear(1000, 1000)
        self.layer2 = nn.Linear(1000, 1000)
        self.layer3 = nn.Linear(1000, 1000)

    def forward(self, x):
        # Checkpoint expensive layers
        x = checkpoint(self.layer1, x)
        x = checkpoint(self.layer2, x)
        x = self.layer3(x)
        return x

# Memory: 3x меньше, Speed: ~20% медленнее
```

### Efficient DataLoader

```python
def create_efficient_dataloader(
    dataset,
    batch_size: int,
    num_workers: int = 4
) -> DataLoader:
    """Create optimized DataLoader."""
    return DataLoader(
        dataset,
        batch_size=batch_size,
        num_workers=num_workers,
        pin_memory=True,  # Faster GPU transfer
        persistent_workers=True,  # Reuse workers between epochs
        prefetch_factor=2,  # Prefetch 2 batches per worker
        drop_last=True  # Drop incomplete last batch для consistent shapes
    )

# Profile data loading
from tqdm import tqdm
import time

def benchmark_dataloader(dataloader):
    """Measure dataloader throughput."""
    start = time.time()
    for batch in tqdm(dataloader):
        pass  # Just iterate
    elapsed = time.time() - start

    print(f"Throughput: {len(dataloader) / elapsed:.2f} batches/sec")
```

### Model Compilation (PyTorch 2.0+)

```python
import torch._dynamo as dynamo

# Правильно - compile для 2x speedup
model = create_model()
model = torch.compile(model, mode='reduce-overhead')  # или 'max-autotune'

# Modes:
# - default: balanced
# - reduce-overhead: минимум overhead
# - max-autotune: максимум optimization (медленный compile)
```

### Learning Rate Warmup

```python
from torch.optim.lr_scheduler import LambdaLR

def get_warmup_scheduler(
    optimizer: torch.optim.Optimizer,
    warmup_steps: int,
    total_steps: int
) -> LambdaLR:
    """Learning rate warmup scheduler."""
    def lr_lambda(current_step: int):
        if current_step < warmup_steps:
            # Linear warmup
            return float(current_step) / float(max(1, warmup_steps))
        else:
            # Cosine decay
            progress = (current_step - warmup_steps) / (total_steps - warmup_steps)
            return max(0.0, 0.5 * (1.0 + np.cos(np.pi * progress)))

    return LambdaLR(optimizer, lr_lambda)

# Usage
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
scheduler = get_warmup_scheduler(optimizer, warmup_steps=1000, total_steps=10000)

for step in range(10000):
    train_step()
    scheduler.step()
```

## Чеклист Optimization

- ✅ Optuna/Ray Tune для hyperparameter search
- ✅ DDP для multi-GPU training
- ✅ Mixed precision (AMP) для 2x speedup
- ✅ Gradient checkpointing для больших моделей
- ✅ torch.compile (PyTorch 2.0+) для inference
- ✅ Efficient DataLoader настройки
- ✅ Learning rate warmup для стабильности
- ✅ Profile перед оптимизацией (torch.profiler)
- ✅ Monitor GPU memory (nvidia-smi, torch.cuda)
- ✅ Batch size tuning (largest without OOM)
