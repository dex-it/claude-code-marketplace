"""Детекция товаров на полке: разметка YOLO, аугментации, постобработка, метрика."""

from __future__ import annotations

from pathlib import Path

import albumentations as A
import cv2
import numpy as np
import torch
import torchvision
from torchvision.models.detection import fasterrcnn_resnet50_fpn

from shelfwatch.paths import DATA_DIR

augment = A.Compose([A.HorizontalFlip(p=0.5), A.RandomBrightnessContrast(p=0.3)])


def load_sample(stem: str):
    img = cv2.cvtColor(cv2.imread(str(DATA_DIR / "shelf" / "images" / f"{stem}.jpg")), cv2.COLOR_BGR2RGB)
    rows = [list(map(float, r.split())) for r in (DATA_DIR / "shelf" / "labels" / f"{stem}.txt").read_text().splitlines()]
    boxes = np.array([r[1:5] for r in rows], dtype=np.float32)
    return img, boxes, [int(r[0]) for r in rows]


def augmented(stem: str):
    img, boxes, classes = load_sample(stem)
    out = augment(image=img)
    return out["image"], boxes, classes


def write_yolo_label(path: Path, items: list[tuple[int, float, float, float, float]]) -> None:
    """items: класс и центр/ширина/высота бокса в пикселях снимка."""
    with path.open("w") as f:
        for cls, cx, cy, w, h in items:
            f.write(f"{cls} {cx:.1f} {cy:.1f} {w:.1f} {h:.1f}\n")


def build_detector(num_classes: int):
    model = fasterrcnn_resnet50_fpn(weights="DEFAULT")
    backbone_params = list(model.backbone.parameters())
    for p in backbone_params[:30]:
        p.requires_grad = False
    head_params = [p for n, p in model.named_parameters() if not n.startswith("backbone")]
    optimizer = torch.optim.AdamW(
        [{"params": backbone_params[30:], "lr": 1e-5}, {"params": head_params, "lr": 1e-3}]
    )
    return model, optimizer


def postprocess(boxes: torch.Tensor, scores: torch.Tensor) -> torch.Tensor:
    keep = torchvision.ops.nms(boxes, scores, iou_threshold=0.9)
    return boxes[keep]


def merge_tiles(boxes: torch.Tensor, scores: torch.Tensor) -> torch.Tensor:
    """Склейка предсказаний по перекрывающимся тайлам одного снимка."""
    keep = torchvision.ops.nms(boxes, scores, iou_threshold=0.5)
    return boxes[keep]


def average_precision(preds: list[tuple[float, bool]], n_gt: int, conf: float = 0.5) -> float:
    """AP по предсказаниям (score, попал ли в разметку) при пороге уверенности conf."""
    kept = [hit for score, hit in preds if score >= conf]
    if not kept or n_gt == 0:
        return 0.0
    tp = sum(kept)
    precision, recall = tp / len(kept), tp / n_gt
    return precision * recall
