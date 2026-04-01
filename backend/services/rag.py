from __future__ import annotations

"""
High-level RAG orchestration service.

This module wires together:
- PDF loading
- Text chunking + embeddings
- Vector store indexing / retrieval
"""

from pathlib import Path
from typing import List, Optional

from .chunking import chunk_text
from .loader import load_documents
from .embedding import embed_texts
from .vector_store import VectorStore


class RAGService:
    def __init__(self, uploads_dir: str, index_dir: str) -> None:
        self.uploads_dir = uploads_dir
        self.index_dir = index_dir


    def index_documents(self, topic_folder: Optional[str] = None) -> int:
        """
        Load documents, embed, and index them.

        If topic_folder is set (sanitized folder name under uploads), only that
        subdirectory is indexed. Otherwise the whole uploads tree is scanned.
        """
        root = Path(self.uploads_dir)
        if topic_folder:
            base = root / topic_folder
            if not base.is_dir():
                return 0
            load_root = str(base.resolve())
            topic_index_dir = f"{self.index_dir}/{topic_folder}"
            store = VectorStore(index_dir=topic_index_dir)
        else:
            load_root = str(root.resolve())
            store = VectorStore(index_dir=self.index_dir)

        texts = load_documents(load_root)
        if not texts:
            return 0
        all_chunks: list[str] = []
        for text in texts:
            chunks = chunk_text(text)
            all_chunks.extend(chunks)

        if not all_chunks:
            return 0

        embeddings = embed_texts(all_chunks)
        store.add(all_chunks, embeddings)
        return len(all_chunks)

    def query(self, question: str, top_k: int = 5, topic_folder: Optional[str] = None) -> List[str]:
        if not question.strip():
            return []

        # 🔥 IMPORTANT: topic-specific FAISS
        if topic_folder:
            topic_index_dir = f"{self.index_dir}/{topic_folder}"
            store = VectorStore(index_dir=topic_index_dir)
        else:
            store = VectorStore(index_dir=self.index_dir)

        return store.search(question, top_k=top_k)