---
description: Convert model between formats (PyTorch→ONNX, TensorFlow→TFLite)
allowed-tools: Bash, Read, Write, Grep, Glob
argument-hint: <model-path> <target-format>
---

# /convert

Конвертация модели в другие форматы для deployment.

## Процесс

1. **Detect source format:**
```bash
if [[ $model_path == *.pth ]]; then
    echo "Source: PyTorch"
elif [[ $model_path == *.h5 ]] || [[ $model_path == *.keras ]]; then
    echo "Source: TensorFlow"
elif [[ $model_path == *.pkl ]]; then
    echo "Source: scikit-learn/pickle"
fi
```

2. **Convert to target format:**

**PyTorch → ONNX:**
```python
import torch.onnx

model = torch.load('model.pth')
model.eval()
dummy_input = torch.randn(1, 3, 224, 224)

torch.onnx.export(
    model, dummy_input, 'model.onnx',
    export_params=True,
    opset_version=14,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {0: 'batch'}, 'output': {0: 'batch'}}
)
```

**TensorFlow → TFLite:**
```python
import tensorflow as tf

model = tf.keras.models.load_model('model.h5')
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()

with open('model.tflite', 'wb') as f:
    f.write(tflite_model)
```

3. **Validate conversion:**
```python
# Compare outputs
original_output = original_model(test_input)
converted_output = converted_model(test_input)
diff = np.abs(original_output - converted_output).max()
print(f"Max difference: {diff:.6f}")
assert diff < 1e-5, "Conversion produced different results!"
```

4. **Benchmark converted model:**
```bash
python benchmark.py --model model.onnx --batch-size 1 --iterations 100
```

## Вывод

```
Model Conversion: ResNet50 → ONNX

Source Model:
- Format: PyTorch (.pth)
- Size: 97.8 MB
- Input: [batch, 3, 224, 224]
- Output: [batch, 1000]

Target Model:
✓ Format: ONNX
✓ Size: 97.5 MB (similar)
✓ Opset version: 14
✓ Dynamic axes: batch dimension

Validation:
✓ Output comparison: Max diff = 2.38e-07 (acceptable)
✓ Test accuracy: 0.842 (original) vs 0.842 (ONNX) ✓
✓ Inference successful on 1000 samples

Performance:
                   Original (PyTorch)  Converted (ONNX)
Latency (P50):     15.2 ms             12.8 ms  (-15.8%)
Throughput:        65 samples/sec      78 samples/sec
Memory:            1.2 GB              0.9 GB

Quantization (Optional):
- INT8 quantized ONNX: 24.4 MB (-75%)
- Latency: ~5-7 ms (2-3x faster)
- Accuracy drop: ~1-2%

Files Created:
✓ model.onnx - ONNX model
✓ model_metadata.json - Input/output specs
✓ validation_report.txt

Next steps:
1. Test ONNX model in production environment
2. Consider INT8 quantization if latency critical
3. Use TensorRT for additional optimization
4. Deploy with /serve command
```

## Действия

- Save converted model metadata to MLflow MCP
- Document conversion process in Notion MCP
- Commit ONNX model to GitLab LFS
- Update deployment docs with new format
