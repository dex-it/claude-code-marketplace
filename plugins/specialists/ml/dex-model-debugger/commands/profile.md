---
description: Performance profiling -- FLOPs, memory, latency, throughput
allowed-tools: Bash, Read, Grep, Glob
argument-hint: <model-path>
---

# /profile

Профилирование performance модели -- compute, memory, latency.

## Goal

Измерить FLOPs, параметры, inference latency (P50/P95/P99), peak memory, определить bottleneck layers. Дать рекомендации по оптимизации (quantization, pruning, TensorRT).

## Output

- Model size: parameters count, file size, FLOPs
- Inference latency: P50, P95, P99 для batch_size=1 и batch_size=32
- Memory usage: model weights, activation memory, peak memory
- Bottleneck layers: top-3 по compute time
- Optimization recommendations с estimated speedup
