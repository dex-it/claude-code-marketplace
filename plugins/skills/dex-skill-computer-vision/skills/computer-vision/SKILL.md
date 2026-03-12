---
name: computer-vision
description: Computer Vision — ловушки augmentation, detection, segmentation, training. Активируется при computer vision, cnn, resnet, yolo, u-net, detection, segmentation, augmentation
allowed-tools: Read, Grep, Glob
---

# Computer Vision — ловушки

## Правила

- ImageNet normalization (`mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]`) для pretrained моделей — без неё features мусорные
- Augmentation только на train, НИКОГДА на val/test
- BGR vs RGB: OpenCV читает BGR, PyTorch/PIL ожидает RGB
- Transfer learning: freeze backbone → train head → unfreeze → fine-tune с малым LR

## Частые ошибки

| Ошибка | Последствие | Решение |
|--------|-------------|---------|
| Augmentation на val/test | Метрики нестабильны, не отражают реальность | Augment только train, val/test = resize + crop + normalize |
| Нет нормализации для pretrained | Features backbone бессмысленны | ImageNet mean/std для ImageNet-pretrained моделей |
| BGR/RGB перепутаны | Модель учит перевёрнутые цвета | `cv2.cvtColor(img, cv2.COLOR_BGR2RGB)` после `cv2.imread` |
| `transforms.Resize(224)` | Resize по короткой стороне, не в квадрат | `transforms.Resize((224, 224))` для точного размера |
| Одинаковый augment для train/val | Val augmentation портит метрики | Отдельные transforms: train = augment, val = только resize+normalize |
| Fine-tune с LR=1e-3 | Pretrained features уничтожены | Backbone: 1e-5, head: 1e-3 (differential LR) |

## Augmentation ловушки

```
Плохо:
  transform = A.Compose([
      A.HorizontalFlip(),
      A.VerticalFlip(),     # Перевёрнутые фото людей = nonsense
      A.RandomRotation(180)  # Перевернутые здания = не бывает в реальности
  ])
  // Augmentation должна соответствовать домену

Хорошо (медицинские снимки):
  A.VerticalFlip()    # OK — патология может быть в любой ориентации
  A.Rotate(limit=180) # OK — срезы без "верха/низа"

Хорошо (фото с камеры):
  A.HorizontalFlip()  # OK — зеркальное отражение реалистично
  A.Rotate(limit=15)  # OK — небольшой наклон камеры
  // НЕ VerticalFlip, НЕ Rotation(180) для реальных фото

Плохо:
  A.Compose([transforms], bbox_params=None)
  # Для detection: augment изображение, но не bbox → координаты неверные

Хорошо:
  A.Compose([transforms], bbox_params=A.BboxParams(format='pascal_voc'))
  # bbox трансформируется вместе с изображением
```

## Detection ловушки

```
Плохо:
  conf_threshold = 0.5
  detections = model(image, conf=conf_threshold)
  // Без NMS: десятки overlapping boxes на одном объекте

Плохо:
  NMS с iou_threshold=0.9
  // Почти ничего не фильтрует, дубликаты остаются
  Правило: iou_threshold 0.3-0.5 для большинства задач

Плохо:
  # Evaluation с одним порогом confidence
  mAP = compute_ap(predictions, conf=0.5)
  // mAP = area under precision-recall curve, считается по ВСЕМ порогам

Плохо:
  # YOLO data.yaml с неправильными path
  train: images/train  # Относительный путь
  // YOLO ожидает абсолютные пути или относительно data.yaml

  # Labels: вместо YOLO format (class cx cy w h normalized)
  0 100 200 50 60  # Абсолютные координаты!
  // YOLO: 0 0.5 0.4 0.1 0.12 (нормализованные 0-1)
```

## Segmentation ловушки

```
Плохо:
  loss = CrossEntropyLoss()(pred, mask)
  // Для binary segmentation с 90% background:
  // Модель предсказывает "всё background" → loss низкий, полезность = 0

Хорошо:
  loss = DiceLoss()(pred, mask) + CrossEntropyLoss()(pred, mask)
  // Dice Loss не чувствителен к class imbalance
  // Combo = стабильная сходимость + чувствительность к overlap

Плохо:
  # U-Net: input size не кратен 2^(num_downsamples)
  input = torch.randn(1, 3, 100, 100)  # 100 / 16 = 6.25 → crash на concat
  // Skip connections: encoder и decoder feature maps не совпадают по размеру

Правило:
  Input size кратен 2^N, где N = кол-во pooling слоёв
  Для 4 уровня U-Net: кратно 16 (256, 512, 1024...)
```

## Model selection таблица

| Задача | Быстро/лёгкий | Точно/тяжёлый | Когда ViT |
|--------|---------------|---------------|-----------|
| Classification | EfficientNet-B0 | EfficientNet-B4, ConvNeXt | >10K images, GPU inference |
| Detection | YOLOv8n/s | YOLOv8l, DINO | Не для real-time |
| Segmentation | U-Net (encoder: ResNet34) | DeepLabV3+, SegFormer | Когда accuracy > speed |
| Малый dataset (<1K) | Transfer + freeze | Transfer + fine-tune last layers | Не используй ViT |

## Чек-лист

- [ ] BGR→RGB конвертация после cv2.imread
- [ ] ImageNet normalization для pretrained моделей
- [ ] Augmentation только на train, адекватна домену
- [ ] Detection: bbox transforms вместе с image
- [ ] Segmentation: Dice + CE loss для imbalanced masks
- [ ] Input size кратен 2^(pooling layers) для U-Net
- [ ] Differential LR: backbone < head
- [ ] Val/Test: детерминированный transform (resize + crop + normalize)
