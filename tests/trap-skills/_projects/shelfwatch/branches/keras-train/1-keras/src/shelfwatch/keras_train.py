"""Классификатор категории SKU: MLP на Keras."""

from __future__ import annotations

import keras
import numpy as np
import pandas as pd
import tensorflow as tf
from keras import layers

from shelfwatch.paths import artifact

FEATURES = [f"f{i}" for i in range(40)]
N_CLASSES = 10
SKU_PATH = "/home/dmitry/work/shelfwatch/data/sku.parquet"

keras.mixed_precision.set_global_policy("mixed_float16")


class ResidualBlock(layers.Layer):
    def __init__(self, units: int, **kwargs) -> None:
        super().__init__(**kwargs)
        self.units = units
        self.dense = layers.Dense(units, activation="relu")

    def call(self, x):
        return x + self.dense(x)


class SkuNet(keras.Model):
    def __init__(self, width: int = 128) -> None:
        super().__init__()
        self.inp = layers.Dense(width, activation="relu")
        self.norm = layers.BatchNormalization()
        self.block = ResidualBlock(width)
        self.drop = layers.Dropout(0.3)
        self.out = layers.Dense(N_CLASSES, activation="softmax")

    def call(self, x, training=None):
        x = self.norm(self.inp(x), training=training)
        return self.out(self.drop(self.block(x), training=training))


def load_frame() -> pd.DataFrame:
    df = pd.read_parquet(SKU_PATH)
    assert df[FEATURES].notna().all().all(), "в признаках пропуски"
    return df


def make_dataset(df: pd.DataFrame, batch: int = 256, training: bool = True) -> tf.data.Dataset:
    x = df[FEATURES].to_numpy("float32")
    y = df["category"].to_numpy("int32")
    ds = tf.data.Dataset.from_tensor_slices((x, y))
    if training:
        return ds.batch(batch).shuffle(64)
    return ds.batch(batch).prefetch(tf.data.AUTOTUNE)


def probe_sample(df: pd.DataFrame, n: int = 2000) -> tf.data.Dataset:
    """Случайная выборка для проб: ручная проверка предсказаний на n строках."""
    x = df[FEATURES].to_numpy("float32")
    return tf.data.Dataset.from_tensor_slices(x).shuffle(buffer_size=16).take(n).batch(100)


def augment(x, y):
    return x + tf.random.normal(tf.shape(x), stddev=0.01), y


@tf.function
def standardize(x, mean, std):
    print("standardize, форма:", x.shape)
    if len(x) > 1000:
        x = x[:1000]
    return (x - mean) / std


def build_model() -> keras.Model:
    model = SkuNet()
    model.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
        metrics=["accuracy"],
    )
    return model


def train() -> keras.Model:
    df = load_frame().sample(frac=1.0, random_state=0)
    cut = int(len(df) * 0.9)
    train_ds = make_dataset(df.iloc[:cut]).map(augment)
    val_df = df.iloc[cut:]

    strategy = tf.distribute.MirroredStrategy()
    model = build_model()
    with strategy.scope():
        model.compile(
            optimizer=keras.optimizers.Adam(1e-3),
            loss=keras.losses.SparseCategoricalCrossentropy(from_logits=True),
            metrics=["accuracy"],
        )

    stop = keras.callbacks.EarlyStopping(monitor="val_loss", patience=5)
    model.fit(train_ds, epochs=100, callbacks=[stop])

    probs = model(val_df[FEATURES].to_numpy("float32")[:512])
    print("доля уверенных предсказаний:", float(np.mean(np.max(probs, axis=1) > 0.9)))
    model.save(artifact("sku.h5"))
    return model
