from __future__ import annotations

"""
Embedding helpers.

Right now this uses a simple placeholder (random vectors).
Later you can swap in OpenAI / local embedding models.
"""

from typing import Iterable, List

import numpy as np


def embed_texts(texts: Iterable[str], dim: int = 384) -> List[list[float]]:
    """
    Return one vector per text.

    Placeholder: random vectors with fixed seed so runs are deterministic.
    """
    texts = list(texts)
    if not texts:
        return []

    rng = np.random.default_rng(seed=42)
    vectors = rng.normal(size=(len(texts), dim)).astype("float32")
    return vectors.tolist()

