import pandas as pd

from shelfwatch.baseline import NUM


def test_numeric_columns_listed() -> None:
    df = pd.DataFrame({c: [1.0] for c in NUM})
    assert list(df.columns) == NUM
