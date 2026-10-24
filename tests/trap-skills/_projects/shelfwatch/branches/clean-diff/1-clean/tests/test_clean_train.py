import numpy as np

from shelfwatch.clean_train import N_FEATURES, make_loader


def test_loader_shuffles_only_when_asked() -> None:
    x = np.arange(20, dtype="float32").reshape(10, 2)
    y = np.zeros(10, dtype="int64")
    batch, _ = next(iter(make_loader(x, y, 5, shuffle=False)))
    assert batch.shape == (5, 2)
    assert N_FEATURES == 40
