"""
Text chunking before embedding.

RecursiveCharacterTextSplitter was chosen over hand-rolled splitting because it handles
edge cases (very long single paragraphs, mixed newlines) while we still inject a
**custom separator order**—course PDFs read better when breaks respect structure before
arbitrary character cuts.

Overlap exists because embedding a paragraph in isolation loses the sentence that
spanned the previous chunk boundary, which hurts recall for “continue from above” style questions.
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter

# Defaults sit in the 800–1000 / 150–200 ranges requested for RAG.
_DEFAULT_CHUNK_SIZE = 900
_DEFAULT_CHUNK_OVERLAP = 175

# Order matters: try the largest “natural” units first (paragraph → line → sentence).
# Only if a segment is still larger than chunk_size does the splitter recurse to the
# next separator, so long paragraphs break on sentences before breaking mid-phrase.
_RAG_SEPARATORS = [
    "\n\n",
    "\n",
    ". ",
    "! ",
    "? ",
    "; ",
    " ",
    "",
]


def chunk_text(
    text: str,
    chunk_size: int = _DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = _DEFAULT_CHUNK_OVERLAP,
) -> list[str]:
    if not text.strip():
        return []

    size = max(1, chunk_size)
    overlap = min(max(0, chunk_overlap), size - 1)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=_RAG_SEPARATORS,
        keep_separator=False,
        strip_whitespace=True,
    )
    return splitter.split_text(text)
