from __future__ import annotations

"""
Document text extraction for RAG.

Why `rglob` under a base path: uploads are organized in nested topic folders; scanning
from a root picks up every supported file without hard-coding layout.

Why per-format loaders: students upload PDFs, slides, and Word docs; one entrypoint
(`load_documents`) keeps RAG code agnostic of file type.

Why lazy imports inside ppt/doc helpers: keeps startup lighter if those deps are missing
until someone actually indexes those types.
"""

from pathlib import Path
from typing import List

from pypdf import PdfReader


def load_pdfs(base: Path) -> List[str]:
    texts: List[str] = []
    for path in base.rglob("*.pdf"):
        try:
            reader = PdfReader(str(path))
            for page in reader.pages:
                txt = (page.extract_text() or "").strip()
                if txt:
                    texts.append(txt)
        except Exception as e:
            print(f"Error reading {path.name}: {e}")
    return texts


def load_txt(base: Path) -> List[str]:
    texts: List[str] = []
    for path in base.rglob("*.txt"):
        try:
            txt = path.read_text(encoding="utf-8", errors="ignore").strip()
            if txt:
                texts.append(txt)
        except Exception as e:
            print(f"Error reading {path.name}: {e}")
    return texts


def load_ppt(base: Path) -> List[str]:
    texts: List[str] = []
    for pattern in ("*.pptx", "*.ppt"):
        for path in base.rglob(pattern):
            try:
                from pptx import Presentation
                prs = Presentation(str(path))
                for slide in prs.slides:
                    slide_text = " ".join(
                        shape.text for shape in slide.shapes if hasattr(shape, "text")
                    ).strip()
                    if slide_text:
                        texts.append(slide_text)
            except Exception as e:
                print(f"Error reading {path.name}: {e}")
    return texts


def load_doc(base: Path) -> List[str]:
    texts: List[str] = []
    for pattern in ("*.docx", "*.doc"):
        for path in base.rglob(pattern):
            try:
                from docx import Document
                doc = Document(str(path))
                for para in doc.paragraphs:
                    txt = para.text.strip()
                    if txt:
                        texts.append(txt)
            except Exception as e:
                print(f"Error reading {path.name}: {e}")
    return texts


def load_documents(uploads_dir: str) -> List[str]:
    base = Path(uploads_dir)
    if not base.exists():
        return []

    documents: List[str] = []
    documents.extend(load_pdfs(base))
    documents.extend(load_txt(base))
    documents.extend(load_ppt(base))
    documents.extend(load_doc(base))
    return documents

