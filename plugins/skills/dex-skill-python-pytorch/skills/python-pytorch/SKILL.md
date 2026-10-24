---
name: python-pytorch
description: PyTorch - цикл обучения, чтение значения потери с GPU на каждом батче. Активируется при pytorch, training loop, loss.item, цикл обучения, nn.Module, optimizer.step, backward, GPU, синхронизация, лог потери
---

# PyTorch - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- `loss.item()` на каждом батче цикла обучения: каждый вызов синхронизирует CPU с GPU (PyTorch Performance Tuning Guide)
