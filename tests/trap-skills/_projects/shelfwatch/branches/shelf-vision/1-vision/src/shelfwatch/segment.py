"""Сегментация пустых мест на полке (U-Net, 4 уровня)."""

from __future__ import annotations

import torch
from torch import nn


def block(cin: int, cout: int) -> nn.Sequential:
    return nn.Sequential(nn.Conv2d(cin, cout, 3, padding=1), nn.ReLU(), nn.Conv2d(cout, cout, 3, padding=1), nn.ReLU())


class UNet(nn.Module):
    def __init__(self, base: int = 16) -> None:
        super().__init__()
        chans = [base * 2**i for i in range(5)]
        self.down = nn.ModuleList([block(3, chans[0])] + [block(chans[i], chans[i + 1]) for i in range(4)])
        self.pool = nn.MaxPool2d(2)
        self.up = nn.ModuleList([nn.ConvTranspose2d(chans[i + 1], chans[i], 2, stride=2) for i in range(4)])
        self.dec = nn.ModuleList([block(chans[i] * 2, chans[i]) for i in range(4)])
        self.head = nn.Conv2d(chans[0], 2, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        skips = []
        for i, d in enumerate(self.down):
            x = d(x)
            if i < 4:
                skips.append(x)
                x = self.pool(x)
        for i in reversed(range(4)):
            x = self.dec[i](torch.cat([self.up[i](x), skips[i]], dim=1))
        return self.head(x)


criterion = nn.CrossEntropyLoss()  # маска: 3% пикселей - пустое место, остальное - товар и фон
