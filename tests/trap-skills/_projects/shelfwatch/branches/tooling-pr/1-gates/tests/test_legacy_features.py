import pytest

from shelfwatch.legacy_features import store_score


@pytest.mark.slwo
def test_store_score_runs() -> None:
    assert store_score([], 1.0) is not None
