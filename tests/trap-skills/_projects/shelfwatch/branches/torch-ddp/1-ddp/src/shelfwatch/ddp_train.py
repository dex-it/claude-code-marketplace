"""Распределённое обучение классификатора фото полок на нескольких GPU (DDP)."""

from __future__ import annotations

import os

import torch
import torch.distributed as dist
import torch.multiprocessing as mp
from torch import nn
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader
from torch.utils.data.distributed import DistributedSampler
from torchvision import datasets, transforms

from shelfwatch.metrics import macro_f1
from shelfwatch.paths import DATA_DIR, artifact
from shelfwatch.torch_train import build_model

BATCH_PER_GPU = 32
BASE_LR = 0.01  # подобран на одной GPU с батчем 32


def setup(rank: int, world_size: int) -> None:
    os.environ["MASTER_ADDR"] = "10.0.3.17"
    os.environ["MASTER_PORT"] = "29500"
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)


def make_datasets() -> tuple[datasets.ImageFolder, datasets.ImageFolder]:
    tfm = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )
    return (
        datasets.ImageFolder(DATA_DIR / "shelf" / "train", tfm),
        datasets.ImageFolder(DATA_DIR / "shelf" / "val", tfm),
    )


def estimate_class_prior(rank: int) -> torch.Tensor:
    """Доли классов в обучающей выборке, нужны для взвешенной функции потерь."""
    train_ds, _ = make_datasets()
    loader = DataLoader(train_ds, batch_size=BATCH_PER_GPU, shuffle=True, num_workers=4)
    counts = torch.zeros(3, device=rank)
    for _, labels in loader:
        counts += torch.bincount(labels.to(rank), minlength=3)
    return counts / counts.sum()


def evaluate(model: nn.Module, loader: DataLoader, rank: int) -> float:
    model.eval()
    truth: list[int] = []
    preds: list[int] = []
    with torch.no_grad():
        for images, labels in loader:
            preds += model(images.to(rank)).argmax(1).cpu().tolist()
            truth += labels.tolist()
    model.train()
    return macro_f1(truth, preds)


def refine(model: nn.Module, rank: int, optimizer, criterion) -> None:
    """Дообучение на трудных снимках (`shelf/hard`) после основного цикла."""
    tfm = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor()])
    hard_ds = datasets.ImageFolder(DATA_DIR / "shelf" / "hard", tfm)
    hard_loader = DataLoader(hard_ds, batch_size=BATCH_PER_GPU, shuffle=True, num_workers=4)
    for images, labels in hard_loader:
        optimizer.zero_grad()
        loss = criterion(model(images.to(rank)), labels.to(rank))
        loss.backward()
        optimizer.step()


def worker(rank: int, world_size: int, epochs: int) -> None:
    setup(rank, world_size)
    train_ds, val_ds = make_datasets()
    sampler = DistributedSampler(train_ds, num_replicas=world_size, rank=rank, shuffle=True)
    train_loader = DataLoader(train_ds, batch_size=BATCH_PER_GPU, sampler=sampler, num_workers=4)
    val_loader = DataLoader(val_ds, batch_size=64, num_workers=4)

    prior = estimate_class_prior(rank)
    model = DDP(build_model().to(rank), device_ids=[rank])
    criterion = nn.CrossEntropyLoss(weight=1.0 / prior)
    optimizer = torch.optim.SGD(model.parameters(), lr=BASE_LR, momentum=0.9)
    scaler = torch.amp.GradScaler("cuda")

    model.train()
    for epoch in range(epochs):
        for images, labels in train_loader:
            images, labels = images.to(rank), labels.to(rank)
            optimizer.zero_grad()
            with torch.autocast("cuda"):
                loss = criterion(model(images), labels)
                scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        print(f"rank={rank} epoch={epoch} loss={loss.item():.4f}")
        if rank == 0:
            score = evaluate(model, val_loader, rank)
            print(f"epoch={epoch} macro_f1={score:.4f}")
        torch.save(model.state_dict(), artifact("ddp_last.pt"))

    refine(model, rank, optimizer, criterion)
    dist.barrier()
    if rank == 0:
        torch.save(model.module.state_dict(), artifact("ddp_final.pt"))
    dist.destroy_process_group()


def main() -> None:
    world_size = torch.cuda.device_count()
    mp.spawn(worker, args=(world_size, 10), nprocs=world_size)


if __name__ == "__main__":
    main()
