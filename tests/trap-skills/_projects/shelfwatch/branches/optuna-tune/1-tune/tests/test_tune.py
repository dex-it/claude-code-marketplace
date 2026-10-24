import numpy as np

from shelfwatch.tune import N_CLASSES, N_FEATURES, make_loader


def test_loader_batches() -> None:
    x = np.zeros((10, N_FEATURES), dtype="float32")
    y = np.zeros(10, dtype="int64") % N_CLASSES
    assert next(iter(make_loader(x, y, 4)))[0].shape == (4, N_FEATURES)
