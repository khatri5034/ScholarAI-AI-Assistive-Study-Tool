from __future__ import annotations

"""
RAG orchestration: load → chunk → embed → index → query.

Design goals for this codebase (vs a heavier RAG framework):
- Stay file-local (FAISS + JSON) so students can run the stack without Docker or paid DBs.
- Over-fetch then dedupe: FAISS neighbors are cheap; near-duplicate prose in slides/PDFs
  is not—trimming before the LLM saves tokens and confusion more than aggressive top_k.
- Optional topic summary JSON: one-time LLM cost at index time to give short plans/quiz
  a coarse map when raw chunks are scattered.
"""

import difflib
import json
import logging
import shutil
from pathlib import Path
from typing import List, Optional

from .chunking import chunk_text
from .loader import load_documents
from .embedding import embed_texts
from .vector_store import VectorStore

logger = logging.getLogger(__name__)

_ALL_TOPICS_KEY = "__all__"  # Explicit sentinel: “no topic” indexing without magic empty string.

# Over-fetch before dedupe: duplicates often sit adjacent in embedding space; extra hits
# let us keep diverse snippets after `_near_dup` filtering.
_CANDIDATE_MULTIPLIER = 8
_MIN_CANDIDATES = 24

_MIN_CHUNK_CHARS = 28  # Headers/footers shorter than this rarely carry exam-relevant signal.

_NEAR_DUP_RATIO = 0.90  # High threshold: only collapse near-copy paste, not paraphrases.

_TOPIC_SUMMARY_FILE = "topic_summary.json"
_SUMMARY_INPUT_CAP = 48_000  # Bound index-time LLM cost/material; summaries are hints, not fulltext.


def _normalize_chunk_key(text: str) -> str:
    return " ".join(text.split()).lower()


def dedupe_chunks(
    chunks: List[str],
    *,
    min_chars: int = _MIN_CHUNK_CHARS,
    near_dup_ratio: float = _NEAR_DUP_RATIO,
) -> List[str]:
    """
    Remove exact duplicates (after whitespace normalize) and near-duplicates using
    sequence similarity against already-kept chunks (FAISS order preserved).
    """
    out: List[str] = []
    norms_kept: List[str] = []
    seen_exact: set[str] = set()

    for raw in chunks:
        t = raw.strip()
        if len(t) < min_chars:
            continue
        key = _normalize_chunk_key(t)
        if key in seen_exact:
            continue
        if any(
            difflib.SequenceMatcher(None, key, nk).ratio() >= near_dup_ratio
            for nk in norms_kept
        ):
            continue
        seen_exact.add(key)
        norms_kept.append(key)
        out.append(t)
    return out


def _clean_chunk_body(text: str) -> str:
    """Normalize whitespace while keeping line breaks between lines."""
    lines = [" ".join(line.split()) for line in text.strip().splitlines()]
    body = "\n".join(line for line in lines if line)
    while "\n\n\n" in body:
        body = body.replace("\n\n\n", "\n\n")
    return body.strip()


def format_rag_context(
    chunks: List[str],
    summary: Optional[str] = None,
) -> str:
    """Combine optional topic overview (from index-time LLM summary) with retrieved excerpts."""
    parts: List[str] = []
    if summary and summary.strip():
        parts.append(f"## Topic overview\n{summary.strip()}")
    for i, raw in enumerate(chunks, 1):
        body = _clean_chunk_body(raw)
        if not body:
            continue
        parts.append(f"## Excerpt {i}\n{body}")
    return "\n\n".join(parts)


def _material_for_summary(texts: List[str]) -> str:
    joined = "\n\n---\n\n".join(t.strip() for t in texts if t and t.strip())
    return joined[:_SUMMARY_INPUT_CAP]


def _llm_topic_summary(material: str) -> Optional[str]:
    if not material.strip():
        return None
    prompt = f"""Read the following material from course documents. Write a concise overview of the KEY IDEAS for study.

Requirements:
- Short paragraphs or bullet points, at most ~350 words.
- Capture main concepts, relationships, and important terms.
- Do not invent facts. If the excerpt is sparse, write a shorter overview.
- No introduction or closing pleasantries — start directly with the overview.

--- MATERIAL ---
{material}
"""
    try:
        from agents.gemini_client import call_gemini
    except ImportError:
        return None
    try:
        out = call_gemini(prompt).strip()
        return out if out else None
    except Exception as e:
        logger.warning("Topic summary LLM call failed: %s", e)
        return None


def _write_topic_summary(index_path: Path, texts: List[str]) -> None:
    material = _material_for_summary(texts)
    overview = _llm_topic_summary(material)
    if not overview:
        return
    path = index_path / _TOPIC_SUMMARY_FILE
    path.write_text(
        json.dumps({"overview": overview}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


class RAGService:
    def __init__(self, documents_root: str) -> None:
        self.documents_root = documents_root

    def _index_path(self, user_folder: str, topic_folder: Optional[str]) -> Path:
        root = Path(self.documents_root)
        if topic_folder:
            return root / user_folder / "faiss_index" / topic_folder
        return root / user_folder / "faiss_index" / _ALL_TOPICS_KEY

    def get_topic_summary(
        self,
        user_folder: str,
        topic_folder: Optional[str] = None,
    ) -> Optional[str]:
        """Load the index-time overview from ``topic_summary.json`` if present."""
        path = self._index_path(user_folder, topic_folder) / _TOPIC_SUMMARY_FILE
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            o = data.get("overview")
            return o.strip() if isinstance(o, str) and o.strip() else None
        except (OSError, json.JSONDecodeError, TypeError):
            return None

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
        else:
            base = uploads_root

        index_path = self._index_path(user_folder, topic_folder)

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
        _write_topic_summary(index_path, texts)
        return len(all_chunks)

    def query(
        self,
        question: str,
        top_k: int = 10,
        user_folder: Optional[str] = None,
        topic_folder: Optional[str] = None,
    ) -> List[str]:
        """
        Return up to ``top_k`` distinct, non-trivial chunks. Retrieves more neighbors
        from FAISS first, then deduplicates so results are not repetitive.
        """
        if not question.strip() or not user_folder:
            return []

        index_path = self._index_path(user_folder, topic_folder)
        store = VectorStore(index_dir=str(index_path.resolve()))
        n_docs = len(store.texts)
        if n_docs == 0:
            return []

        want = max(1, top_k)
        candidate_k = min(n_docs, max(want * _CANDIDATE_MULTIPLIER, _MIN_CANDIDATES))
        raw = store.search(question, top_k=candidate_k)
        refined = dedupe_chunks(raw)
        return refined[:want]