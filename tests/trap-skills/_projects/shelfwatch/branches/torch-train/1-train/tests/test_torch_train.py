import torch

from shelfwatch.torch_train import CLASSES, build_model, predict


def test_predict_returns_probabilities() -> None:
    model = build_model()
    probs = predict(model, torch.zeros(2, 3, 224, 224))
    assert probs.shape == (2, len(CLASSES))
    assert torch.allclose(probs.sum(dim=1), torch.ones(2), atol=1e-5)
