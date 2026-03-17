from __future__ import annotations

"""
High-level RAG orchestration service.

This module wires together:
- PDF loading
- Text chunking + embeddings
- Vector store indexing / retrieval
"""

from typing import List

from .pdf_loader import load_pdfs_from_dir
from .embedding import embed_texts
from .vector_store import VectorStore


class RAGService:
    def __init__(self, uploads_dir: str, index_dir: str) -> None:
        self.uploads_dir = uploads_dir
        self.index_dir = index_dir
        self.store = VectorStore(index_dir=index_dir)

    def index_documents(self) -> int:
        """Load PDFs, embed, and index them. Returns number of chunks indexed."""
        texts = load_pdfs_from_dir(self.uploads_dir)
        if not texts:
            return 0

        embeddings = embed_texts(texts)
        self.store.add(texts, embeddings)
        return len(texts)

    def query(self, question: str, top_k: int = 5) -> List[str]:
        """Return top_k relevant chunks for a question."""
        if not question.strip():
            return []
        return self.store.search(question, top_k=top_k)

