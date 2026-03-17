from __future__ import annotations

"""
Very small FAISS-backed vector store wrapper.

This keeps the surface area tiny so you can later
swap in a more advanced store without changing the
rest of the app.
"""

from pathlib import Path
from typing import Iterable, List

import faiss  # type: ignore
import numpy as np


class VectorStore:
    def __init__(self, index_dir: str) -> None:
        self.index_dir = Path(index_dir)
        self.index_dir.mkdir(parents=True, exist_ok=True)

        self.index_path = self.index_dir / "index.faiss"
        self.meta_path = self.index_dir / "texts.txt"

        self.index = None
        self.texts: List[str] = []

        self._load()

    def _load(self) -> None:
        if self.index_path.exists():
            self.index = faiss.read_index(str(self.index_path))
        if self.meta_path.exists():
            self.texts = self.meta_path.read_text(encoding="utf-8").splitlines()

    def _persist(self) -> None:
        if self.index is not None:
            faiss.write_index(self.index, str(self.index_path))
        if self.texts:
            self.meta_path.write_text("\n".join(self.texts), encoding="utf-8")

    def add(self, texts: Iterable[str], embeddings: Iterable[Iterable[float]]) -> None:
        texts = list(texts)
        vectors = np.asarray(list(embeddings), dtype="float32")
        if not len(texts):
            return

        dim = vectors.shape[1]
        if self.index is None:
            self.index = faiss.IndexFlatL2(dim)

        self.index.add(vectors)
        self.texts.extend(texts)
        self._persist()

    def search(self, query: str, top_k: int = 5) -> List[str]:
        if self.index is None or not self.texts:
            return []

        # NOTE: for now we just reuse the embedding placeholder
        from .embedding import embed_texts

        vec = np.asarray(embed_texts([query]), dtype="float32")
        _, idx = self.index.search(vec, top_k)
        results: List[str] = []
        for i in idx[0]:
            if 0 <= i < len(self.texts):
                results.append(self.texts[i])
        return results

