---
description: Convert model between formats (PyTorch->ONNX, TensorFlow->TFLite)
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: <model-path> <target-format>
---

# /convert

Конвертация модели в другие форматы для deployment.

## Goal

Определить source format модели, сконвертировать в target format (ONNX, TFLite, TorchScript), валидировать что output совпадает с оригиналом.

## Output

- Converted model file (model.onnx / model.tflite / model.pt)
- Validation report: max output difference (должен быть < 1e-5)
- Performance comparison: latency/size original vs converted
- `model_metadata.json` -- input/output shapes, dynamic axes
