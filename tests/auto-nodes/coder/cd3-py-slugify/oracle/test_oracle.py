import pytest

from slug import slugify


def test_r1_diacritics():
    assert slugify("Crème Brûlée") == "creme-brulee"


def test_r2_separators():
    assert slugify("  Hello,   World!  ") == "hello-world"


def test_r2_no_edge_hyphens():
    assert slugify("--a--b--") == "a-b"


def test_r3_word_boundary():
    assert slugify("alpha beta gamma", max_len=12) == "alpha-beta"


def test_r3_exact_fit():
    assert slugify("alpha beta gamma", max_len=10) == "alpha-beta"


def test_r3_long_first_word():
    assert slugify("abcdefgh ij", max_len=5) == "abcde"


def test_r3_default_unlimited():
    assert slugify("a " * 50) == "-".join(["a"] * 50)


def test_r4_empty():
    with pytest.raises(ValueError):
        slugify("")


def test_r4_only_signs_message():
    with pytest.raises(ValueError, match=r"\?!\?"):
        slugify("?!?")
