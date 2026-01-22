---
name: computer-vision
description: Computer Vision - CNN architectures, image classification, object detection, segmentation, augmentation. Активируется при computer vision, cnn, resnet, yolo, u-net, detection, segmentation, augmentation
allowed-tools: Read, Grep, Glob
---

# Computer Vision Patterns

## Image Classification

### Transfer Learning с torchvision

```python
from typing import Tuple
import torch
import torch.nn as nn
from torchvision import models, transforms
from torchvision.models import ResNet50_Weights

# Правильно - использовать pretrained веса
def create_image_classifier(
    num_classes: int,
    model_name: str = 'resnet50',
    freeze_backbone: bool = True
) -> nn.Module:
    """Create image classifier with transfer learning."""
    # Load pretrained model
    if model_name == 'resnet50':
        weights = ResNet50_Weights.IMAGENET1K_V2
        model = models.resnet50(weights=weights)
        num_features = model.fc.in_features

        # Replace classifier head
        model.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_features, num_classes)
        )
    elif model_name == 'efficientnet_b0':
        weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1
        model = models.efficientnet_b0(weights=weights)
        num_features = model.classifier[1].in_features

        model.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(num_features, num_classes)
        )

    # Freeze backbone if needed
    if freeze_backbone:
        for param in model.parameters():
            param.requires_grad = False
        # Unfreeze classifier
        for param in model.fc.parameters() if hasattr(model, 'fc') else model.classifier.parameters():
            param.requires_grad = True

    return model

# Правильные transforms
def get_transforms(training: bool = True) -> transforms.Compose:
    """Get image transforms for training/inference."""
    if training:
        return transforms.Compose([
            transforms.RandomResizedCrop(224),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                              std=[0.229, 0.224, 0.225])  # ImageNet stats
        ])
    else:
        return transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                              std=[0.229, 0.224, 0.225])
        ])
```

## Data Augmentation с Albumentations

### Production Augmentation Pipeline

```python
import albumentations as A
from albumentations.pytorch import ToTensorV2
import cv2
import numpy as np

# Правильно - мощная augmentation для training
def get_training_augmentations(image_size: int = 224) -> A.Compose:
    """Get albumentations pipeline for training."""
    return A.Compose([
        # Spatial transforms
        A.RandomResizedCrop(image_size, image_size, scale=(0.8, 1.0)),
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.1),
        A.ShiftScaleRotate(
            shift_limit=0.1,
            scale_limit=0.2,
            rotate_limit=15,
            p=0.5
        ),

        # Color transforms
        A.OneOf([
            A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=1.0),
            A.HueSaturationValue(hue_shift_limit=20, sat_shift_limit=30, val_shift_limit=20, p=1.0),
            A.RGBShift(r_shift_limit=20, g_shift_limit=20, b_shift_limit=20, p=1.0),
        ], p=0.5),

        # Noise and blur
        A.OneOf([
            A.GaussianBlur(blur_limit=(3, 7), p=1.0),
            A.GaussNoise(var_limit=(10.0, 50.0), p=1.0),
        ], p=0.3),

        # Normalization
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2()
    ])

def get_validation_augmentations(image_size: int = 224) -> A.Compose:
    """Get transforms for validation/inference."""
    return A.Compose([
        A.Resize(256, 256),
        A.CenterCrop(image_size, image_size),
        A.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ToTensorV2()
    ])

# Usage
image = cv2.imread('image.jpg')
image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
augmented = get_training_augmentations()(image=image)
tensor = augmented['image']  # torch.Tensor [3, 224, 224]
```

## Object Detection с YOLO

### YOLOv8 Fine-tuning

```python
from ultralytics import YOLO
import torch

# Правильно - fine-tune YOLOv8
def train_yolo_detector(
    data_yaml_path: str,
    epochs: int = 100,
    img_size: int = 640,
    batch_size: int = 16
) -> YOLO:
    """Train YOLOv8 object detector."""
    # Load pretrained model
    model = YOLO('yolov8n.pt')  # nano model для быстрого обучения
    # Альтернативы: yolov8s.pt (small), yolov8m.pt (medium), yolov8l.pt (large)

    # Train
    results = model.train(
        data=data_yaml_path,  # Path to data.yaml
        epochs=epochs,
        imgsz=img_size,
        batch=batch_size,
        patience=50,  # Early stopping
        device=0,  # GPU
        workers=8,
        optimizer='AdamW',
        lr0=0.01,
        lrf=0.01,  # Final learning rate
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3,
        warmup_momentum=0.8,
        box=7.5,  # Box loss gain
        cls=0.5,  # Classification loss gain
        dfl=1.5,  # DFL loss gain
        save=True,
        plots=True
    )

    return model

# data.yaml format:
# path: /path/to/dataset
# train: images/train
# val: images/val
# names:
#   0: person
#   1: car
#   2: dog

# Inference
def detect_objects(model: YOLO, image_path: str, conf_threshold: float = 0.5) -> list:
    """Run object detection."""
    results = model(image_path, conf=conf_threshold)

    # Parse results
    detections = []
    for result in results:
        boxes = result.boxes
        for box in boxes:
            detections.append({
                'class': int(box.cls),
                'confidence': float(box.conf),
                'bbox': box.xyxy[0].tolist(),  # [x1, y1, x2, y2]
                'class_name': model.names[int(box.cls)]
            })

    return detections
```

## Semantic Segmentation с U-Net

### U-Net Implementation

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class DoubleConv(nn.Module):
    """(Conv -> BN -> ReLU) * 2"""

    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.double_conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_channels, out_channels, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_channels),
            nn.ReLU(inplace=True)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.double_conv(x)

class UNet(nn.Module):
    """U-Net for image segmentation."""

    def __init__(self, in_channels: int = 3, num_classes: int = 2):
        super().__init__()
        # Encoder (downsampling)
        self.enc1 = DoubleConv(in_channels, 64)
        self.enc2 = DoubleConv(64, 128)
        self.enc3 = DoubleConv(128, 256)
        self.enc4 = DoubleConv(256, 512)

        self.pool = nn.MaxPool2d(2)

        # Bottleneck
        self.bottleneck = DoubleConv(512, 1024)

        # Decoder (upsampling)
        self.up4 = nn.ConvTranspose2d(1024, 512, kernel_size=2, stride=2)
        self.dec4 = DoubleConv(1024, 512)

        self.up3 = nn.ConvTranspose2d(512, 256, kernel_size=2, stride=2)
        self.dec3 = DoubleConv(512, 256)

        self.up2 = nn.ConvTranspose2d(256, 128, kernel_size=2, stride=2)
        self.dec2 = DoubleConv(256, 128)

        self.up1 = nn.ConvTranspose2d(128, 64, kernel_size=2, stride=2)
        self.dec1 = DoubleConv(128, 64)

        # Output
        self.out = nn.Conv2d(64, num_classes, kernel_size=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Encoder
        enc1 = self.enc1(x)
        enc2 = self.enc2(self.pool(enc1))
        enc3 = self.enc3(self.pool(enc2))
        enc4 = self.enc4(self.pool(enc3))

        # Bottleneck
        bottleneck = self.bottleneck(self.pool(enc4))

        # Decoder with skip connections
        dec4 = self.up4(bottleneck)
        dec4 = torch.cat([dec4, enc4], dim=1)
        dec4 = self.dec4(dec4)

        dec3 = self.up3(dec4)
        dec3 = torch.cat([dec3, enc3], dim=1)
        dec3 = self.dec3(dec3)

        dec2 = self.up2(dec3)
        dec2 = torch.cat([dec2, enc2], dim=1)
        dec2 = self.dec2(dec2)

        dec1 = self.up1(dec2)
        dec1 = torch.cat([dec1, enc1], dim=1)
        dec1 = self.dec1(dec1)

        return self.out(dec1)

# Training с Dice Loss
class DiceLoss(nn.Module):
    """Dice loss для segmentation."""

    def forward(self, pred: torch.Tensor, target: torch.Tensor, smooth: float = 1.0) -> torch.Tensor:
        pred = torch.sigmoid(pred)
        pred = pred.contiguous().view(-1)
        target = target.contiguous().view(-1)

        intersection = (pred * target).sum()
        dice = (2. * intersection + smooth) / (pred.sum() + target.sum() + smooth)

        return 1 - dice
```

## Vision Transformers (ViT)

```python
from transformers import ViTForImageClassification, ViTImageProcessor

# Правильно - использовать ViT для classification
def create_vit_classifier(num_labels: int) -> nn.Module:
    """Create Vision Transformer classifier."""
    model = ViTForImageClassification.from_pretrained(
        'google/vit-base-patch16-224',
        num_labels=num_labels,
        ignore_mismatched_sizes=True  # For different num_classes
    )
    return model

# Preprocessing для ViT
processor = ViTImageProcessor.from_pretrained('google/vit-base-patch16-224')

def preprocess_for_vit(images: list[np.ndarray]) -> torch.Tensor:
    """Preprocess images for ViT."""
    inputs = processor(images=images, return_tensors="pt")
    return inputs['pixel_values']
```

## Grad-CAM для Interpretability

```python
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image

def visualize_attention(
    model: nn.Module,
    image: torch.Tensor,
    target_layer: nn.Module,
    target_class: int
) -> np.ndarray:
    """Visualize model attention with Grad-CAM."""
    # Create GradCAM
    cam = GradCAM(model=model, target_layers=[target_layer])

    # Generate CAM
    grayscale_cam = cam(
        input_tensor=image.unsqueeze(0),
        targets=[target_class]
    )

    # Overlay on image
    grayscale_cam = grayscale_cam[0, :]
    return grayscale_cam

# Usage for ResNet
model = models.resnet50(pretrained=True)
target_layer = model.layer4[-1]  # Last conv layer
cam = visualize_attention(model, image, target_layer, target_class=281)  # cat
```

## Post-processing для Detection

### Non-Maximum Suppression (NMS)

```python
from torchvision.ops import nms

def apply_nms(
    boxes: torch.Tensor,  # [N, 4] in format [x1, y1, x2, y2]
    scores: torch.Tensor,  # [N]
    iou_threshold: float = 0.5
) -> torch.Tensor:
    """Apply Non-Maximum Suppression."""
    keep_indices = nms(boxes, scores, iou_threshold)
    return keep_indices

# Usage
boxes = torch.tensor([[10, 10, 50, 50], [12, 12, 48, 48], [100, 100, 150, 150]])
scores = torch.tensor([0.9, 0.85, 0.95])
keep = apply_nms(boxes, scores, iou_threshold=0.5)
# keep = [0, 2]  # Remove overlapping box [1]

filtered_boxes = boxes[keep]
filtered_scores = scores[keep]
```

## Mixed Precision Training для CV

```python
from torch.cuda.amp import autocast, GradScaler

def train_cv_model_amp(
    model: nn.Module,
    dataloader: torch.utils.data.DataLoader,
    optimizer: torch.optim.Optimizer,
    device: torch.device
) -> None:
    """Train CV model with AMP."""
    scaler = GradScaler()
    model.train()

    for images, targets in dataloader:
        images, targets = images.to(device), targets.to(device)

        optimizer.zero_grad()

        # Mixed precision forward
        with autocast():
            outputs = model(images)
            loss = F.cross_entropy(outputs, targets)

        # Scaled backward
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
```

## Чеклист Best Practices

- ✅ Transfer learning с ImageNet weights
- ✅ Правильная нормализация (ImageNet mean/std)
- ✅ Albumentations для мощной augmentation
- ✅ Mixed precision для 2x speedup
- ✅ Progressive resizing (train small → finetune large)
- ✅ Test-time augmentation для inference
- ✅ Grad-CAM для interpretability
- ✅ NMS для детекции
- ✅ Dice/IoU loss для segmentation
- ✅ Multi-scale training для robust models
