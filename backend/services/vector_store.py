from __future__ import annotations

"""
FAISS persistence + JSON sidecar for chunk text.

Why FAISS: simple, local, no separate vector DB service — good for demos and laptops.

Why IndexFlatIP + L2 normalize: cosine similarity via inner product is a standard
pattern for normalized embedding vectors.

Why JSON for texts: FAISS only stores vectors; we need the original strings back at
query time. A sidecar file keeps the MVP small vs. a full metadata database.
"""

from pathlib import Path
from typing import Iterable, List
import faiss
import numpy as np
import json

from .embedding import embed_texts


class VectorStore:
    def __init__(self, index_dir: str) -> None:
        self.index_dir = Path(index_dir)
        self.index_dir.mkdir(parents=True, exist_ok=True)

        self.index_path = self.index_dir / "index.faiss"
        self.meta_path = self.index_dir / "texts.json"

        self.index = None
        self.texts: List[str] = []

        self._load()

    def _load(self) -> None:
        if self.index_path.exists():
            self.index = faiss.read_index(str(self.index_path))

        if self.meta_path.exists():
            self.texts = json.loads(self.meta_path.read_text(encoding="utf-8"))

    def _persist(self) -> None:
        if self.index is not None:
            faiss.write_index(self.index, str(self.index_path))

        if self.texts:
            self.meta_path.write_text(
                json.dumps(self.texts, ensure_ascii=False, indent=2),
                encoding="utf-8"
            )

    def add(self, texts: Iterable[str], embeddings: Iterable[Iterable[float]]) -> None:
        texts = list(texts)
        vectors = np.asarray(list(embeddings), dtype="float32")

        if not texts:
            return

        # Normalized vectors → inner product equals cosine similarity.
        faiss.normalize_L2(vectors)

        dim = vectors.shape[1]

        if self.index is None:
            self.index = faiss.IndexFlatIP(dim)

        self.index.add(vectors)
        self.texts.extend(texts)

        self._persist()

    def search(self, query: str, top_k: int = 5) -> List[str]:
        if self.index is None or not self.texts:
            return []

        vec = np.asarray(embed_texts([query]), dtype="float32")

        # normalize query vector
        faiss.normalize_L2(vec)

        scores, indices = self.index.search(vec, top_k)

        results: List[str] = []
        for i in indices[0]:
            if 0 <= i < len(self.texts):
                results.append(self.texts[i])

        return results