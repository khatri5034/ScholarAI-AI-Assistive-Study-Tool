from __future__ import annotations

"""
PDF loading utilities for RAG.
"""

from pathlib import Path
from typing import List

from pypdf import PdfReader


def load_pdfs_from_dir(uploads_dir: str) -> List[str]:
    """Return a list of page texts from all PDFs in uploads_dir."""
    base = Path(uploads_dir)
    if not base.exists():
        return []

    texts: List[str] = []
    for path in base.glob("*.pdf"):
        reader = PdfReader(str(path))
        for page in reader.pages:
            txt = page.extract_text() or ""
            txt = txt.strip()
            if txt:
                texts.append(txt)
    return texts

