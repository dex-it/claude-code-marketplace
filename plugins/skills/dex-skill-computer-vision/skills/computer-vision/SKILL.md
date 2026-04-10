---
name: computer-vision
description: Computer Vision — ловушки augmentation, detection, segmentation. Активируется при computer vision, cnn, resnet, yolo, u-net, detection, segmentation, augmentation, BGR, RGB, EfficientNet, NMS, bbox, albumentations, ViT
---

# Computer Vision — ловушки

## Preprocessing

### BGR не конвертирован в RGB
Плохо: `cv2.imread(path)` -> `transforms.Normalize(mean=[0.485, 0.456, 0.406])` — ImageNet нормализация на BGR
Правильно: `cv2.cvtColor(img, cv2.COLOR_BGR2RGB)` сразу после cv2.imread
Почему: OpenCV читает BGR, PyTorch/PIL ожидает RGB. Перепутанные каналы = модель учит мусор, features бессмысленны

### Нет ImageNet normalization для pretrained
Плохо: `transforms.ToTensor()` без нормализации для pretrained ResNet/EfficientNet
Правильно: `transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])`
Почему: pretrained backbone обучен на нормализованных данных. Без нормализации features слоёв = мусор

### Resize без точного размера
Плохо: `transforms.Resize(224)` — resize по короткой стороне, не в квадрат
Правильно: `transforms.Resize((224, 224))` — кортеж для точного размера
Почему: Resize(int) сохраняет aspect ratio. Если вход не квадратный — размер не совпадёт с ожидаемым

## Augmentation

### Augmentation на val/test
Плохо: один и тот же transform с `RandomFlip`, `ColorJitter` для train и val
Правильно: train = augment + normalize, val/test = только resize + crop + normalize
Почему: augmentation на val даёт нестабильные метрики — каждый прогон разный результат

### Augmentation не соответствует домену
Плохо: `VerticalFlip()` + `RandomRotation(180)` для фото людей — перевёрнутые люди не бывают
Правильно: для фото с камеры — `HorizontalFlip`, `Rotate(limit=15)`. Для медицины — `VerticalFlip`, `Rotate(180)` допустимы
Почему: нереалистичный augment добавляет noise, модель учит распознавать то, чего не будет в production

### Augment image без bbox transform
Плохо: `A.Compose([transforms])` для detection без `bbox_params` — bbox координаты не обновляются
Правильно: `A.Compose([transforms], bbox_params=A.BboxParams(format='pascal_voc'))`
Почему: image повернулся, а bbox остался на старом месте — модель учится на неправильных координатах

## Transfer Learning

### Fine-tune с большим LR
Плохо: fine-tune pretrained модели с `lr=1e-3` — pretrained features уничтожены за пару эпох
Правильно: differential LR: backbone `1e-5`, head `1e-3`
Почему: backbone содержит обученные features (edges, textures). Высокий LR стирает их — катастрофическое забывание

### Не заморожен backbone
Плохо: сразу fine-tune все слои pretrained модели на маленьком dataset
Правильно: freeze backbone -> train head (5-10 эпох) -> unfreeze -> fine-tune с малым LR
Почему: на маленьком dataset full fine-tune = overfit. Поэтапный подход сохраняет pretrained features

## Detection

### NMS не применён или порог неверный
Плохо: детекция без NMS — десятки overlapping boxes на одном объекте. Или NMS с `iou_threshold=0.9`
Правильно: NMS с `iou_threshold=0.3-0.5` для большинства задач
Почему: без NMS = дубликаты. Высокий порог почти ничего не фильтрует. Низкий (0.3-0.5) убирает дубли, оставляя уникальные

### YOLO координаты не нормализованы
Плохо: YOLO labels с абсолютными координатами `0 100 200 50 60`
Правильно: YOLO формат: `class cx cy w h` нормализованные 0-1, например `0 0.5 0.4 0.1 0.12`
Почему: YOLO ожидает нормализованные координаты относительно размера изображения. Абсолютные = неверные bbox

### mAP с одним порогом confidence
Плохо: `compute_ap(predictions, conf=0.5)` — оценка при одном пороге
Правильно: mAP = area under precision-recall curve по ВСЕМ порогам confidence
Почему: один порог не показывает качество модели. mAP оценивает ранжирование предсказаний целиком

## Segmentation

### CrossEntropy без DiceLoss при imbalance
Плохо: `CrossEntropyLoss()` для binary segmentation с 90% background
Правильно: `DiceLoss() + CrossEntropyLoss()` — combo loss
Почему: CE на imbalanced mask = модель предсказывает "всё background", loss низкий. Dice не чувствителен к imbalance

### Input size не кратен 2^N для U-Net
Плохо: `input = torch.randn(1, 3, 100, 100)` для U-Net с 4 pooling — 100/16 = 6.25, crash на skip connection
Правильно: input size кратен `2^N` где N = количество pooling слоёв. Для 4 уровней — кратно 16 (256, 512)
Почему: encoder и decoder feature maps не совпадают по размеру при concat — RuntimeError

## Model Selection

| Задача | Быстро/лёгкий | Точно/тяжёлый | Когда ViT |
|--------|---------------|---------------|-----------|
| Classification | EfficientNet-B0 | ConvNeXt, EfficientNet-B4 | >10K images, GPU inference |
| Detection | YOLOv8n/s | YOLOv8l, DINO | Не для real-time |
| Segmentation | U-Net (ResNet34) | DeepLabV3+, SegFormer | Когда accuracy > speed |
| Малый dataset (<1K) | Transfer + freeze | Fine-tune last layers | Не используй ViT |

## Чек-лист

- BGR->RGB конвертация после cv2.imread
- ImageNet normalization для pretrained моделей
- Augmentation только на train, адекватна домену
- Detection: bbox transforms вместе с image
- Segmentation: Dice + CE loss для imbalanced masks
- Input size кратен 2^(pooling layers) для U-Net
- Differential LR: backbone < head
- Val/Test: детерминированный transform (resize + normalize)
