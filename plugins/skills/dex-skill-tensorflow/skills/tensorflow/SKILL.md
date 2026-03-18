---
name: tensorflow
description: TensorFlow/Keras — ловушки training, tf.data, callbacks, saving. Активируется при tensorflow, keras, tf.data, callback, SavedModel, tf.function, EarlyStopping, MirroredStrategy, mixed_precision, from_logits, get_config, prefetch, AUTOTUNE, .h5, .keras
---

# TensorFlow/Keras — ловушки

## Правила

- `training=True/False` в `call()` обязателен — BatchNorm и Dropout ведут себя по-разному
- `@tf.function` для custom training loops — без этого eager mode в 10x медленнее
- `prefetch(tf.data.AUTOTUNE)` в конце pipeline — без этого GPU простаивает
- Output layer при mixed precision — `dtype='float32'`, иначе numerical instability

## Частые ошибки

| Ошибка | Последствие | Решение |
|--------|-------------|---------|
| Забыл `training=` в `call()` | BN/Dropout всегда в train mode при inference | `model(x, training=False)` для inference |
| `get_config()` не переопределён | Custom layer не сериализуется, `model.save()` падает | Всегда `get_config()` для custom layers |
| `fit()` без `validation_data` | Нет early stopping, overfitting не виден | Всегда передавай val set |
| `map()` без `num_parallel_calls` | tf.data pipeline однопоточный, GPU голодает | `map(fn, num_parallel_calls=tf.data.AUTOTUNE)` |
| `shuffle()` после `batch()` | Перемешиваются batch'и, не элементы — слабая рандомизация | `shuffle()` ДО `batch()` |
| `from_logits` не совпадает | `softmax` + `from_logits=True` = двойной softmax | Без softmax → `from_logits=True`, с softmax → `from_logits=False` |
| EarlyStopping без `restore_best_weights` | Останавливается, но модель = последняя, не лучшая | `restore_best_weights=True` |

## tf.data pipeline — порядок имеет значение

```
Плохо:
  dataset.batch(32).shuffle(1000).map(augment)
  // 1. batch → shuffle перемешивает batch'и, не samples
  // 2. augment после batch → augment получает batch tensor

Хорошо:
  dataset.shuffle(1000).map(augment, num_parallel_calls=AUTOTUNE).batch(32).prefetch(AUTOTUNE)
  // Правильный порядок: shuffle → map → batch → prefetch

Плохо:
  dataset = dataset.shuffle(buffer_size=10)  # buffer 10 из 100000
  // shuffle_buffer << dataset_size → почти нет рандомизации

Правило:
  buffer_size >= dataset_size для полной рандомизации
  Минимум: buffer_size >= 1000 (или 10% от dataset)
```

## Saving/Loading ловушки

```
Плохо:
  model.save('model.h5')
  // .h5 формат deprecated, не поддерживает custom objects
  // SavedModel — дефолт, .keras — новый формат

Плохо:
  model.save('my_model')
  loaded = keras.models.load_model('my_model')
  // Если есть custom layers без get_config() → crash

Плохо:
  # Subclassed model
  class MyModel(keras.Model): ...
  model.save_weights('weights')  # OK
  model.save('full_model')  # Может не работать!
  // Subclassed models не полностью serializable через save()
  // Используй save_weights() + architecture в коде
```

## Mixed Precision ловушки

```
Плохо:
  mixed_precision.set_global_policy('mixed_float16')
  outputs = Dense(10, activation='softmax')(x)
  // softmax в float16 → overflow/underflow

Хорошо:
  outputs = Dense(10, dtype='float32', activation='softmax')(x)
  // Output layer всегда float32

Плохо:
  mixed_precision.set_global_policy('mixed_float16')
  optimizer = keras.optimizers.Adam(lr=1e-3)
  // Loss scaling нужен для FP16 gradients

Хорошо:
  optimizer = keras.optimizers.Adam(lr=1e-3)
  optimizer = mixed_precision.LossScaleOptimizer(optimizer)
```

## Multi-GPU ловушка

```
Плохо:
  strategy = tf.distribute.MirroredStrategy()
  model = create_model()
  with strategy.scope():
      model.compile(...)
  // Модель создана ВНЕ strategy.scope() — не реплицируется

Хорошо:
  strategy = tf.distribute.MirroredStrategy()
  with strategy.scope():
      model = create_model()  # Создать внутри scope!
      model.compile(...)
```

## @tf.function ловушки

```
Плохо:
  @tf.function
  def train_step(data):
      print(f"Processing {data}")  # Python print — выполнится ОДИН раз при tracing
      if len(data) > 10:           # Python if — зафиксируется при tracing

Хорошо:
  @tf.function
  def train_step(data):
      tf.print("Processing", data)  # tf.print — каждый вызов
      if tf.shape(data)[0] > 10:    # tf.cond — динамическое условие
```

## Чек-лист

- [ ] `training=True/False` передаётся корректно
- [ ] Custom layers имеют `get_config()`
- [ ] tf.data: shuffle → map(AUTOTUNE) → batch → prefetch(AUTOTUNE)
- [ ] `from_logits` согласован с activation
- [ ] EarlyStopping с `restore_best_weights=True`
- [ ] Mixed precision: output layer `dtype='float32'`
- [ ] Модель создана внутри `strategy.scope()`
- [ ] `@tf.function`: tf.print, tf.cond вместо Python аналогов
