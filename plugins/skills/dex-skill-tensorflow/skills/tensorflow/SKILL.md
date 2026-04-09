---
name: tensorflow
description: TensorFlow/Keras — ловушки training, tf.data, callbacks, saving. Активируется при tensorflow, keras, tf.data, callback, SavedModel, tf.function, EarlyStopping, MirroredStrategy, mixed_precision, from_logits, prefetch, AUTOTUNE, .h5, .keras
---

# TensorFlow/Keras — ловушки

## Training

### training= не передаётся в call()
Плохо: `model(x)` без `training=` — BatchNorm и Dropout всегда в train mode при inference
Правильно: `model(x, training=False)` для inference, `model(x, training=True)` для обучения
Почему: BN использует batch statistics вместо running, Dropout отбрасывает нейроны — метрики inference нестабильны

### from_logits не согласован с activation
Плохо: `Dense(10, activation='softmax')` + `CategoricalCrossentropy(from_logits=True)` — двойной softmax
Правильно: без softmax в слое -> `from_logits=True`, с softmax в слое -> `from_logits=False`
Почему: двойной softmax даёт численно неправильные градиенты, модель плохо сходится. Без softmax + from_logits=False = softmax не применяется, loss неверный

### EarlyStopping без restore_best_weights
Плохо: `EarlyStopping(patience=5)` — останавливается, но модель = последняя эпоха, не лучшая
Правильно: `EarlyStopping(patience=5, restore_best_weights=True)`
Почему: последняя эпоха часто хуже лучшей (overfit). Без restore — теряешь лучший checkpoint

### fit() без validation_data
Плохо: `model.fit(X_train, y_train, epochs=100)` — нет мониторинга overfitting
Правильно: `model.fit(X_train, y_train, validation_data=(X_val, y_val), callbacks=[EarlyStopping])`
Почему: без val set не видно overfitting, EarlyStopping не работает, модель тренируется до конца впустую

## tf.data Pipeline

### shuffle() после batch()
Плохо: `dataset.batch(32).shuffle(1000)` — перемешиваются batch'и, не элементы
Правильно: `dataset.shuffle(1000).map(fn, num_parallel_calls=AUTOTUNE).batch(32).prefetch(AUTOTUNE)`
Почему: shuffle после batch = слабая рандомизация. Элементы внутри batch всегда рядом — bias в обучении

### Маленький shuffle buffer
Плохо: `dataset.shuffle(buffer_size=10)` при dataset размером 100000
Правильно: `buffer_size >= dataset_size` для полной рандомизации, минимум 1000 или 10% от dataset
Почему: shuffle берёт случайный элемент из buffer. Buffer 10 из 100K = почти последовательное чтение

### map() без num_parallel_calls
Плохо: `dataset.map(preprocess_fn)` — однопоточный pipeline, GPU простаивает
Правильно: `dataset.map(preprocess_fn, num_parallel_calls=tf.data.AUTOTUNE)`
Почему: preprocessing на CPU в один поток не успевает за GPU — bottleneck на подготовке данных

### Нет prefetch в конце pipeline
Плохо: `dataset.shuffle().map().batch()` — GPU ждёт пока CPU подготовит следующий batch
Правильно: `.prefetch(tf.data.AUTOTUNE)` в конце pipeline
Почему: prefetch загружает следующий batch параллельно с обработкой текущего на GPU

## Saving/Loading

### .h5 формат вместо .keras/SavedModel
Плохо: `model.save('model.h5')` — deprecated формат, не поддерживает custom objects
Правильно: `model.save('model.keras')` или SavedModel (дефолт)
Почему: .h5 не сохраняет custom layers/losses корректно, не поддерживает новый Keras 3 API

### Custom layer без get_config()
Плохо: custom layer без переопределённого `get_config()` — `model.save()` падает
Правильно: всегда реализуй `get_config()` для custom layers, возвращая все параметры конструктора
Почему: Keras сериализует архитектуру через get_config(). Без него — модель невозможно сохранить/загрузить

### Subclassed model через save()
Плохо: `class MyModel(keras.Model): ... model.save('full')` — может не работать
Правильно: `model.save_weights('weights')` + архитектура в коде для subclassed models
Почему: subclassed models не полностью serializable через save() — нет декларативного графа вычислений

## Mixed Precision

### Output layer в float16
Плохо: `mixed_precision.set_global_policy('mixed_float16')` + output `Dense(10, activation='softmax')`
Правильно: `Dense(10, dtype='float32', activation='softmax')` — output layer всегда float32
Почему: softmax в float16 -> overflow/underflow, numerical instability в предсказаниях

### Нет LossScaleOptimizer
Плохо: mixed_float16 policy + обычный `Adam(lr=1e-3)` без loss scaling
Правильно: `mixed_precision.LossScaleOptimizer(optimizer)` — масштабирует loss для FP16 градиентов
Почему: FP16 градиенты underflow к нулю без loss scaling, модель перестаёт учиться

## Multi-GPU

### Модель создана вне strategy.scope()
Плохо: `model = create_model()` затем `with strategy.scope(): model.compile(...)` — модель не реплицируется
Правильно: `with strategy.scope(): model = create_model(); model.compile(...)` — всё внутри scope
Почему: MirroredStrategy реплицирует переменные модели при создании внутри scope. Вне scope = одна копия на одном GPU

## @tf.function

### Python print/if вместо tf.print/tf.cond
Плохо: `@tf.function` + `print(data)` + `if len(data) > 10` — Python ops выполняются один раз при tracing
Правильно: `tf.print()` для вывода, `tf.cond()` / `tf.shape()` для условий
Почему: @tf.function трейсит Python код один раз и компилирует в граф. Python print/if зафиксируются при первом вызове

## Чек-лист

- training=True/False передаётся корректно
- Custom layers имеют get_config()
- tf.data: shuffle -> map(AUTOTUNE) -> batch -> prefetch(AUTOTUNE)
- from_logits согласован с activation
- EarlyStopping с restore_best_weights=True
- Mixed precision: output layer dtype='float32'
- Модель создана внутри strategy.scope()
- @tf.function: tf.print, tf.cond вместо Python аналогов
