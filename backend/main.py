from __future__ import annotations

"""
Minimal FastAPI backend for ScholarAI RAG system.
Handles:
- File upload
- Indexing documents
- Querying RAG
"""

import re
import shutil
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware

from services.rag import RAGService


def sanitize_topic_folder(topic: str) -> str:
    """
    Turn a user-visible study topic into a single safe directory name
    (no path traversal, no slashes).
    """
    raw = (topic or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="topic is required")
    parts: list[str] = []
    for c in raw:
        if c.isalnum() or c in " -_.":
            parts.append(c)
        elif c in "/\\":
            parts.append("_")
        else:
            parts.append("_")
    s = "".join(parts).strip(" ._")[:200]
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        raise HTTPException(status_code=400, detail="topic is invalid")
    return s


def safe_filename(name: str | None) -> str:
    """Use basename only to avoid path traversal."""
    if not name:
        raise HTTPException(status_code=400, detail="filename is required")
    return Path(name).name


def create_app() -> FastAPI:
    app = FastAPI(title="ScholarAI API")

    # CORS (allow frontend access)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Base directories
    UPLOAD_DIR = Path("backend/data/uploads")
    INDEX_DIR = "backend/data/faiss_index"

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    rag_service = RAGService(
        uploads_dir=str(UPLOAD_DIR),
        index_dir=INDEX_DIR,
    )

    # ------------------------
    # Health Check
    # ------------------------
    @app.get("/")
    async def health():
        return {
            "status": "ok",
            "message": "ScholarAI backend running"
        }

    # ------------------------
    # Upload File
    # ------------------------
    ALLOWED_EXTENSIONS = {".pdf", ".txt", ".doc", ".docx", ".ppt", ".pptx"}

    @app.post("/rag/upload")
    async def upload_file(
        file: UploadFile = File(...),
        topic: str = Form(...),
    ):
        extension = Path(file.filename).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{extension}', allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        folder = sanitize_topic_folder(topic)
        dest_dir = UPLOAD_DIR / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        name = safe_filename(file.filename)
        dest = dest_dir / name

        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            rel_path = str(dest.resolve().relative_to(UPLOAD_DIR.resolve()))
        except ValueError:
            rel_path = str(dest)

        return {
            "filename": name,
            "topic_folder": folder,
            "path": rel_path,
            "status": "uploaded",
        }

    # ------------------------
    # Upload Multiple Files
    # ------------------------
    @app.post("/rag/upload-multiple")
    async def upload_files(
        files: list[UploadFile] = File(...),
        topic: str = Form(...),
    ):
        folder = sanitize_topic_folder(topic)
        dest_dir = UPLOAD_DIR / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        uploaded: list[str] = []

        for file in files:
            extension = Path(file.filename).suffix.lower()

            if extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported file type '{extension}', allowed: {', '.join(ALLOWED_EXTENSIONS)}"
                )

            name = safe_filename(file.filename)
            dest = dest_dir / name

            with dest.open("wb") as f:
                shutil.copyfileobj(file.file, f)

            uploaded.append(name)

        return {
            "uploaded": uploaded,
            "topic_folder": folder,
            "status": "uploaded",
        }

    # ------------------------
    # Build Index (run manually)
    # ------------------------
    @app.post("/rag/index")
    async def build_rag_index(topic: str | None = None):
        """
        Build / extend the vector index. If `topic` is provided, only files under
        uploads/<sanitized_topic>/ are indexed; otherwise the whole uploads tree.
        """
        folder: str | None = None
        if topic is not None and str(topic).strip():
            folder = sanitize_topic_folder(str(topic))
        count = rag_service.index_documents(topic_folder=folder)
        return {
            "indexed_chunks": count,
            "topic_folder": folder,
            "status": "index built",
        }

    # ------------------------
    # Query RAG
    # ------------------------
    @app.post("/rag/query")
    async def rag_query(payload: dict):
        question = payload.get("question")
        topic = payload.get("topic")
        top_k = int(payload.get("top_k", 5))

        if not question or not question.strip():
            raise HTTPException(
                status_code=400,
                detail="Question is required"
            )
        folder = sanitize_topic_folder(topic) if topic else None

        chunks = rag_service.query(question, top_k=top_k, topic_folder=folder)

        if not chunks:
            return {
                "question": question,
                "message": "No relevant content found",
                "chunks": []
            }

        return {
            "question": question,
            "topic": folder,
            "chunks": chunks
        }

    # ------------------------
    # List / delete files for a topic folder
    # ------------------------
    @app.get("/rag/files")
    async def list_topic_files(topic: str):
        """List uploaded files for a study topic (sanitized folder under uploads)."""
        folder = sanitize_topic_folder(topic)
        dest_dir = UPLOAD_DIR / folder
        if not dest_dir.is_dir():
            return {"topic_folder": folder, "files": []}
        files_out: list[dict] = []
        for p in sorted(dest_dir.iterdir()):
            if p.is_file():
                try:
                    st = p.stat()
                    files_out.append({"name": p.name, "size": st.st_size})
                except OSError:
                    continue
        return {"topic_folder": folder, "files": files_out}

    @app.delete("/rag/files")
    async def delete_topic_file(topic: str, filename: str):
        """Remove one file from the topic folder and rebuild that topic's vector index."""
        folder = sanitize_topic_folder(topic)
        name = safe_filename(filename)
        base = (UPLOAD_DIR / folder).resolve()
        dest = (base / name).resolve()
        try:
            dest.relative_to(base)
        except ValueError:
            raise HTTPException(status_code=404, detail="File not found")
        if not dest.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        dest.unlink()

        topic_index = Path(INDEX_DIR) / folder
        if topic_index.exists():
            shutil.rmtree(topic_index, ignore_errors=True)

        count = rag_service.index_documents(topic_folder=folder)
        return {
            "removed": name,
            "topic_folder": folder,
            "reindexed_chunks": count,
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)