from shelfwatch.finetune import NER_LABELS, align_labels


def test_align_masks_special_tokens() -> None:
    assert align_labels([None, 0, 1, None], [1, 2]) == [-100, 1, 2, -100]
    assert NER_LABELS[0] == "O"
