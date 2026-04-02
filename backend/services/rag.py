from __future__ import annotations

"""
High-level RAG orchestration service.

This module wires together:
- PDF loading
- Text chunking + embeddings
- Vector store indexing / retrieval

Layout on disk (see main.py sanitizers):
  documents/<user_id>/uploads/<topic>/
  documents/<user_id>/faiss_index/<topic>/
"""

import shutil
from pathlib import Path
from typing import List, Optional

from .chunking import chunk_text
from .loader import load_documents
from .embedding import embed_texts
from .vector_store import VectorStore

# Combined index when indexing all of a user’s uploads at once (no topic filter).
_ALL_TOPICS_KEY = "__all__"


class RAGService:
    def __init__(self, documents_root: str) -> None:
        self.documents_root = documents_root

    def index_documents(
        self,
        user_folder: str,
        topic_folder: Optional[str] = None,
    ) -> int:
        """
        Load documents under one user’s tree, embed, and write a fresh FAISS index for
        either one topic subfolder or the whole uploads tree (__all__).
        """
        root = Path(self.documents_root)
        uploads_root = root / user_folder / "uploads"

        if topic_folder:
            base = uploads_root / topic_folder
            index_path = root / user_folder / "faiss_index" / topic_folder
        else:
            base = uploads_root
            index_path = root / user_folder / "faiss_index" / _ALL_TOPICS_KEY

        if not base.is_dir():
            return 0

        if index_path.exists():
            shutil.rmtree(index_path, ignore_errors=True)

        load_root = str(base.resolve())
        texts = load_documents(load_root)
        if not texts:
            return 0
        all_chunks: list[str] = []
        for text in texts:
            chunks = chunk_text(text)
            all_chunks.extend(chunks)

        if not all_chunks:
            return 0

        store = VectorStore(index_dir=str(index_path.resolve()))
        embeddings = embed_texts(all_chunks)
        store.add(all_chunks, embeddings)
        return len(all_chunks)

    def query(
        self,
        question: str,
        top_k: int = 5,
        user_folder: Optional[str] = None,
        topic_folder: Optional[str] = None,
    ) -> List[str]:
        if not question.strip() or not user_folder:
            return []
        root = Path(self.documents_root)
        if topic_folder:
            index_path = root / user_folder / "faiss_index" / topic_folder
        else:
            index_path = root / user_folder / "faiss_index" / _ALL_TOPICS_KEY

        store = VectorStore(index_dir=str(index_path.resolve()))
        return store.search(question, top_k=top_k)