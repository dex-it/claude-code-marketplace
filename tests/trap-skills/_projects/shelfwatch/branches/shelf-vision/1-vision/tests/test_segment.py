import torch

from shelfwatch.segment import UNet


def test_unet_output_shape() -> None:
    out = UNet()(torch.randn(1, 3, 100, 100))
    assert out.shape == (1, 2, 100, 100)
