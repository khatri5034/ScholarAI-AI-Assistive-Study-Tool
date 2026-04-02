"""
Text chunking before embedding.

Why RecursiveCharacterTextSplitter: respects natural boundaries (paragraphs, sentences)
better than fixed byte splits, which improves retrieval quality for study notes.

Why overlap: keeps context that would otherwise be split across chunk boundaries.
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> list[str]:
    if not text.strip():
        return []

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    return splitter.split_text(text)