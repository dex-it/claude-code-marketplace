import numpy as np

from shelfwatch.keras_train import FEATURES, N_CLASSES, SkuNet


def test_forward_shape() -> None:
    model = SkuNet()
    out = model(np.zeros((4, len(FEATURES)), dtype="float32"))
    assert out.shape == (4, N_CLASSES)
