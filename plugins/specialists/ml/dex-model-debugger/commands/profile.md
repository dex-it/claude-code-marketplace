---
description: Performance profiling - FLOPs, memory, latency, throughput
allowed-tools: Bash, Read, Grep, Glob
argument-hint: <model-path>
---

# /profile

Профилирование performance модели - compute, memory, latency.

## Процесс

1. **Count FLOPs and parameters:**
```bash
python -c "
from thop import profile
flops, params = profile(model, inputs=(dummy_input,))
print(f'FLOPs: {flops/1e9:.2f}G, Params: {params/1e6:.2f}M')
"
```

2. **Measure inference latency:**
```python
import time
import torch

model.eval()
with torch.no_grad():
    # Warmup
    for _ in range(10):
        model(dummy_input)

    # Benchmark
    latencies = []
    for _ in range(100):
        start = time.time()
        output = model(dummy_input)
        latency = (time.time() - start) * 1000  # ms
        latencies.append(latency)

print(f"Latency: P50={np.percentile(latencies, 50):.2f}ms, "
      f"P95={np.percentile(latencies, 95):.2f}ms")
```

3. **Memory profiling:**
```bash
python -c "
import torch
torch.cuda.reset_peak_memory_stats()
output = model(dummy_input)
peak_memory = torch.cuda.max_memory_allocated() / 1024**2  # MB
print(f'Peak memory: {peak_memory:.2f} MB')
"
```

4. **Profile bottlenecks:**
```bash
python -m torch.profiler profile_model.py
# Open chrome://tracing to view trace.json
```

## Вывод

```
Performance Profile: ResNet50

Model Size:
✓ Parameters: 25.6M
✓ FLOPs: 4.1G (per inference)
✓ File size: 97.8 MB

Inference Performance:
✓ Batch size: 1
  - Latency P50: 15.2 ms
  - Latency P95: 18.7 ms
  - Latency P99: 22.3 ms
  - Throughput: 65 samples/sec

✓ Batch size: 32
  - Latency: 285 ms/batch (8.9 ms/sample)
  - Throughput: 112 samples/sec

Memory Usage:
✓ Model weights: 98 MB
✓ Activation memory (batch=1): 45 MB
✓ Activation memory (batch=32): 890 MB
✓ Peak memory: 1.2 GB

Bottleneck Analysis:
1. layer4.2.conv3: 18.5% time (most expensive)
2. layer4.1.conv2: 12.3% time
3. layer4.0.conv1: 9.8% time

Recommendations:
1. Use batch size 32 for 1.7x throughput increase
2. Consider quantization: INT8 → 4x smaller, 2-3x faster
3. Prune layer4 (contributes 40% compute)
4. Use TensorRT for additional 2x speedup

Optimization Potential:
- Current: 15.2 ms latency, 97.8 MB
- With INT8 quantization: ~5-7 ms, 24.5 MB
- With TensorRT: ~2-3 ms, 24.5 MB

Artifacts:
✓ profile_report.txt
✓ trace.json (Chrome trace)
✓ memory_timeline.png
```

## Действия

- Log performance metrics to MLflow MCP
- Document bottlenecks in Notion MCP
- Create optimization task in GitLab if latency > target
