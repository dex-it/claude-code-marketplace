from shelfwatch.ddp_train import BASE_LR, BATCH_PER_GPU


def test_defaults_are_positive() -> None:
    assert BASE_LR > 0
    assert BATCH_PER_GPU > 0
