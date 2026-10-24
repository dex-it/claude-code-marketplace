from shelfwatch.metrics import macro_f1


def test_macro_f1_perfect() -> None:
    assert macro_f1([0, 1, 2], [0, 1, 2]) == 1.0


def test_macro_f1_all_wrong() -> None:
    assert macro_f1([0, 0, 1], [1, 1, 0]) == 0.0
