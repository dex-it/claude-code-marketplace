import re
import unicodedata


def slugify(title, max_len=None):
    ascii_text = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    words = [w for w in re.split(r"[^a-z0-9]+", ascii_text.lower()) if w]
    if not words:
        raise ValueError(f"empty slug: {title!r}")
    slug = "-".join(words)
    if max_len is None or len(slug) <= max_len:
        return slug
    if len(words[0]) > max_len:
        return words[0][:max_len]
    out = words[0]
    for w in words[1:]:
        if len(out) + 1 + len(w) > max_len:
            break
        out += "-" + w
    return out
