---
name: tensorflow-patterns
description: TensorFlow/Keras best practices - tf.keras.Model, tf.data pipelines, callbacks, distributed training. Активируется при tensorflow, keras, tf.data, callback, SavedModel
allowed-tools: Read, Grep, Glob
---

# TensorFlow/Keras Patterns

## tf.keras.Model Patterns

### Functional API (рекомендуется)

```python
from typing import Tuple
import tensorflow as tf
from tensorflow import keras

# Правильно - Functional API для complex architectures
def create_resnet_model(input_shape: Tuple[int, int, int], num_classes: int) -> keras.Model:
    """Create ResNet-like model using Functional API."""
    inputs = keras.Input(shape=input_shape)

    # Conv block
    x = keras.layers.Conv2D(64, 7, strides=2, padding='same')(inputs)
    x = keras.layers.BatchNormalization()(x)
    x = keras.layers.ReLU()(x)
    x = keras.layers.MaxPooling2D(3, strides=2, padding='same')(x)

    # Residual block
    shortcut = x
    x = keras.layers.Conv2D(64, 3, padding='same')(x)
    x = keras.layers.BatchNormalization()(x)
    x = keras.layers.ReLU()(x)
    x = keras.layers.Conv2D(64, 3, padding='same')(x)
    x = keras.layers.BatchNormalization()(x)
    x = keras.layers.Add()([shortcut, x])
    x = keras.layers.ReLU()(x)

    # Classifier
    x = keras.layers.GlobalAveragePooling2D()(x)
    x = keras.layers.Dropout(0.5)(x)
    outputs = keras.layers.Dense(num_classes, activation='softmax')(x)

    model = keras.Model(inputs=inputs, outputs=outputs, name='resnet_classifier')
    return model
```

### Model Subclassing (для research)

```python
class CustomModel(keras.Model):
    """Custom model with complex forward logic."""

    def __init__(self, num_classes: int):
        super().__init__()
        self.conv1 = keras.layers.Conv2D(64, 7, strides=2, padding='same')
        self.bn1 = keras.layers.BatchNormalization()
        self.pool = keras.layers.GlobalAveragePooling2D()
        self.dropout = keras.layers.Dropout(0.5)
        self.fc = keras.layers.Dense(num_classes)

    def call(self, inputs: tf.Tensor, training: bool = False) -> tf.Tensor:
        """Forward pass with custom logic."""
        x = self.conv1(inputs)
        x = self.bn1(x, training=training)  # training flag important!
        x = tf.nn.relu(x)
        x = self.pool(x)
        x = self.dropout(x, training=training)
        return self.fc(x)
```

## Custom Layers

```python
class ResidualBlock(keras.layers.Layer):
    """Custom residual block layer."""

    def __init__(self, filters: int, **kwargs):
        super().__init__(**kwargs)
        self.filters = filters
        self.conv1 = keras.layers.Conv2D(filters, 3, padding='same')
        self.conv2 = keras.layers.Conv2D(filters, 3, padding='same')
        self.bn1 = keras.layers.BatchNormalization()
        self.bn2 = keras.layers.BatchNormalization()
        self.add = keras.layers.Add()

    def call(self, inputs: tf.Tensor) -> tf.Tensor:
        """Forward pass."""
        shortcut = inputs
        x = self.conv1(inputs)
        x = self.bn1(x)
        x = tf.nn.relu(x)
        x = self.conv2(x)
        x = self.bn2(x)
        x = self.add([shortcut, x])
        return tf.nn.relu(x)

    def get_config(self):
        """Required for model saving/loading."""
        config = super().get_config()
        config.update({'filters': self.filters})
        return config
```

## tf.data Pipeline Patterns

### Efficient Data Loading

```python
from pathlib import Path

def create_image_dataset(
    image_dir: Path,
    batch_size: int,
    image_size: Tuple[int, int] = (224, 224),
    shuffle_buffer: int = 1000,
    training: bool = True
) -> tf.data.Dataset:
    """Create optimized tf.data pipeline."""
    # List files
    file_pattern = str(image_dir / "*/*.jpg")
    files_ds = tf.data.Dataset.list_files(file_pattern, shuffle=training)

    # Parse and decode
    def parse_image(filepath: tf.Tensor) -> Tuple[tf.Tensor, tf.Tensor]:
        """Load and preprocess image."""
        # Load
        image = tf.io.read_file(filepath)
        image = tf.image.decode_jpeg(image, channels=3)
        image = tf.image.resize(image, image_size)
        image = tf.cast(image, tf.float32) / 255.0

        # Extract label from directory name
        label = tf.strings.split(filepath, '/')[-2]
        label = tf.strings.to_number(label, out_type=tf.int32)

        return image, label

    # Augmentation
    def augment(image: tf.Tensor, label: tf.Tensor) -> Tuple[tf.Tensor, tf.Tensor]:
        """Apply augmentations."""
        image = tf.image.random_flip_left_right(image)
        image = tf.image.random_brightness(image, 0.2)
        image = tf.image.random_contrast(image, 0.8, 1.2)
        return image, label

    # Build pipeline
    dataset = files_ds.map(parse_image, num_parallel_calls=tf.data.AUTOTUNE)

    if training:
        dataset = dataset.shuffle(shuffle_buffer)
        dataset = dataset.map(augment, num_parallel_calls=tf.data.AUTOTUNE)

    dataset = dataset.batch(batch_size)
    dataset = dataset.prefetch(tf.data.AUTOTUNE)  # Критично для performance!

    return dataset
```

## Training with fit()

### Production Training Setup

```python
def train_model(
    model: keras.Model,
    train_ds: tf.data.Dataset,
    val_ds: tf.data.Dataset,
    epochs: int,
    checkpoint_dir: Path
) -> keras.callbacks.History:
    """Train model with callbacks."""
    # Compile
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss=keras.losses.SparseCategoricalCrossentropy(from_logits=False),
        metrics=['accuracy']
    )

    # Callbacks
    callbacks = [
        # Save best model
        keras.callbacks.ModelCheckpoint(
            filepath=checkpoint_dir / 'best_model.keras',
            monitor='val_loss',
            save_best_only=True,
            mode='min',
            verbose=1
        ),
        # Early stopping
        keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=5,
            mode='min',
            restore_best_weights=True,
            verbose=1
        ),
        # Reduce LR on plateau
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-7,
            verbose=1
        ),
        # TensorBoard logging
        keras.callbacks.TensorBoard(
            log_dir=checkpoint_dir / 'logs',
            histogram_freq=1
        )
    ]

    # Train
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        callbacks=callbacks,
        verbose=1
    )

    return history
```

## Custom Training Loop

### Full Control with GradientTape

```python
@tf.function  # Важно для performance!
def train_step(
    model: keras.Model,
    inputs: tf.Tensor,
    labels: tf.Tensor,
    optimizer: keras.optimizers.Optimizer,
    loss_fn: keras.losses.Loss,
    train_acc_metric: keras.metrics.Metric
) -> tf.Tensor:
    """Single training step."""
    with tf.GradientTape() as tape:
        predictions = model(inputs, training=True)
        loss = loss_fn(labels, predictions)

    # Compute gradients
    gradients = tape.gradient(loss, model.trainable_variables)

    # Gradient clipping
    gradients, _ = tf.clip_by_global_norm(gradients, 1.0)

    # Update weights
    optimizer.apply_gradients(zip(gradients, model.trainable_variables))

    # Update metrics
    train_acc_metric.update_state(labels, predictions)

    return loss

def custom_train_loop(
    model: keras.Model,
    train_ds: tf.data.Dataset,
    val_ds: tf.data.Dataset,
    epochs: int
) -> None:
    """Custom training loop for full control."""
    optimizer = keras.optimizers.Adam(learning_rate=1e-3)
    loss_fn = keras.losses.SparseCategoricalCrossentropy(from_logits=False)

    train_acc_metric = keras.metrics.SparseCategoricalAccuracy()
    val_acc_metric = keras.metrics.SparseCategoricalAccuracy()

    for epoch in range(epochs):
        print(f"\\nEpoch {epoch + 1}/{epochs}")

        # Training
        train_acc_metric.reset_states()
        for step, (inputs, labels) in enumerate(train_ds):
            loss = train_step(model, inputs, labels, optimizer, loss_fn, train_acc_metric)

            if step % 100 == 0:
                print(f"Step {step}: loss={loss:.4f}, acc={train_acc_metric.result():.4f}")

        # Validation
        val_acc_metric.reset_states()
        for inputs, labels in val_ds:
            predictions = model(inputs, training=False)
            val_acc_metric.update_state(labels, predictions)

        print(f"Validation accuracy: {val_acc_metric.result():.4f}")
```

## Mixed Precision Training

```python
from tensorflow.keras import mixed_precision

# Enable mixed precision globally
mixed_precision.set_global_policy('mixed_float16')

def create_model_with_mixed_precision(num_classes: int) -> keras.Model:
    """Model with mixed precision."""
    inputs = keras.Input(shape=(224, 224, 3))
    x = keras.layers.Conv2D(64, 3)(inputs)
    x = keras.layers.BatchNormalization()(x)
    x = keras.layers.ReLU()(x)
    x = keras.layers.GlobalAveragePooling2D()(x)

    # Output layer должен быть float32 для численной стабильности
    outputs = keras.layers.Dense(num_classes, dtype='float32', activation='softmax')(x)

    model = keras.Model(inputs, outputs)
    return model

# Optimizer с loss scaling
optimizer = keras.optimizers.Adam(learning_rate=1e-3)
optimizer = mixed_precision.LossScaleOptimizer(optimizer)
```

## Multi-GPU Training

```python
# Strategy для distributed training
strategy = tf.distribute.MirroredStrategy()
print(f"Number of devices: {strategy.num_replicas_in_sync}")

# Создать модель внутри strategy scope
with strategy.scope():
    model = create_resnet_model(input_shape=(224, 224, 3), num_classes=10)
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )

# Train как обычно - TensorFlow сам распределит по GPU
history = model.fit(train_ds, validation_data=val_ds, epochs=10)
```

## SavedModel Export

```python
# Правильно - SavedModel формат (рекомендуется)
model.save('saved_models/my_model', save_format='tf')

# Load
loaded_model = keras.models.load_model('saved_models/my_model')

# TFLite conversion для mobile/edge
converter = tf.lite.TFLiteConverter.from_saved_model('saved_models/my_model')
converter.optimizations = [tf.lite.Optimize.DEFAULT]  # Quantization
tflite_model = converter.convert()

with open('model.tflite', 'wb') as f:
    f.write(tflite_model)
```

## Чеклист Best Practices

- ✅ Functional API для большинства задач
- ✅ tf.data pipeline с AUTOTUNE
- ✅ `@tf.function` для custom training loops
- ✅ Mixed precision для 2x speedup
- ✅ ModelCheckpoint с `save_best_only=True`
- ✅ EarlyStopping для предотвращения overfitting
- ✅ TensorBoard для визуализации
- ✅ Gradient clipping для стабильности
- ✅ SavedModel формат для сохранения
- ✅ MirroredStrategy для multi-GPU
