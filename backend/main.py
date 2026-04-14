from __future__ import annotations

"""
Minimal FastAPI backend for ScholarAI RAG system.
Handles:
- File upload
- Indexing documents
- Querying RAG

Storage layout (per signed-in user, using Firebase `uid` from the client):
  documents/<user_id>/uploads/<sanitized_topic>/   — raw files
  documents/<user_id>/faiss_index/<sanitized_topic>/ — vectors for that topic
"""

import re
import shutil
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware

from services.rag import RAGService
from models.gemini import generate_answer

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


def sanitize_user_id(user_id: str) -> str:
    """
    Firebase UIDs are alphanumeric; keep a strict allowlist so paths cannot escape
    `documents/<user>/` via traversal or odd characters.
    """
    raw = (user_id or "").strip()
    if not raw or not re.match(r"^[A-Za-z0-9_-]{1,128}$", raw):
        raise HTTPException(status_code=400, detail="user_id is invalid or missing")
    return raw


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

    DOCUMENTS_ROOT = Path("documents")
    DOCUMENTS_ROOT.mkdir(parents=True, exist_ok=True)

    rag_service = RAGService(documents_root=str(DOCUMENTS_ROOT.resolve()))

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
        user_id: str = Form(...),
    ):
        extension = Path(file.filename).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{extension}', allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        user_folder = sanitize_user_id(user_id)
        topic_folder = sanitize_topic_folder(topic)
        dest_dir = DOCUMENTS_ROOT / user_folder / "uploads" / topic_folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        name = safe_filename(file.filename)
        dest = dest_dir / name

        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        try:
            rel_path = str(dest.resolve().relative_to(DOCUMENTS_ROOT.resolve()))
        except ValueError:
            rel_path = str(dest)

        return {
            "filename": name,
            "user_folder": user_folder,
            "topic_folder": topic_folder,
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
        user_id: str = Form(...),
    ):
        user_folder = sanitize_user_id(user_id)
        topic_folder = sanitize_topic_folder(topic)
        dest_dir = DOCUMENTS_ROOT / user_folder / "uploads" / topic_folder
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
            "user_folder": user_folder,
            "topic_folder": topic_folder,
            "status": "uploaded",
        }

    # ------------------------
    # Build Index (run manually)
    # ------------------------
    @app.post("/rag/index")
    async def build_rag_index(user_id: str, topic: str | None = None):
        """
        Rebuild the vector index for one user. With `topic`, only that folder under
        documents/<user>/uploads/<topic>/; without `topic`, all files under that user’s
        uploads tree go into faiss_index/__all__/.
        """
        user_folder = sanitize_user_id(user_id)
        folder: str | None = None
        if topic is not None and str(topic).strip():
            folder = sanitize_topic_folder(str(topic))
        count = rag_service.index_documents(user_folder=user_folder, topic_folder=folder)
        return {
            "indexed_chunks": count,
            "user_folder": user_folder,
            "topic_folder": folder,
            "status": "index built",
        }

    # ------------------------
    # Query RAG
    # ------------------------
    @app.post("/rag/query")
    async def rag_query(payload: dict):
        question = payload.get("question")
        user_raw = payload.get("user_id")
        topic = payload.get("topic")
        top_k = int(payload.get("top_k", 5))

        if not question or not question.strip():
            raise HTTPException(
                status_code=400,
                detail="Question is required"
            )
        user_folder = sanitize_user_id(str(user_raw) if user_raw is not None else "")
        folder = sanitize_topic_folder(topic) if topic else None

        chunks = rag_service.query(
            question,
            top_k=top_k,
            user_folder=user_folder,
            topic_folder=folder,
        )

        if not chunks:
            return {
                "question": question,
                "message": "No relevant content found",
                "chunks": []
            }

        return {
            "question": question,
            "user_folder": user_folder,
            "topic": folder,
            "chunks": chunks
        }
    
    # ------------------------
    # Generate answer
    # ------------------------
    @app.post("/rag/answer")
    async def generate_rag_answer(payload: dict):
        question = payload.get("question") or payload.get("query")
        user = payload.get("user_id")
        topic = payload.get("topic")
        top_k = int(payload.get("top_k", 5))

        if not question or not question.strip():
            raise HTTPException(status_code = 400, detail = "Question is required")

        user_folder = sanitize_user_id(str(user) if user is not None else "")
        folder = sanitize_topic_folder(topic) if topic else None

        chunks = rag_service.query(
            question,
            top_k = top_k,
            user_folder = user_folder,
            topic_folder = folder,
        )

        answer = generate_answer(question, chunks)

        return {
            "question": question,
            "answer": answer,
            "chunks": chunks,
        }

    # ------------------------
    # List / delete files for a topic folder
    # ------------------------
    @app.get("/rag/files")
    async def list_topic_files(user_id: str, topic: str):
        """List uploaded files for this user under documents/<user>/uploads/<topic>/."""
        user_folder = sanitize_user_id(user_id)
        folder = sanitize_topic_folder(topic)
        dest_dir = DOCUMENTS_ROOT / user_folder / "uploads" / folder
        if not dest_dir.is_dir():
            return {"user_folder": user_folder, "topic_folder": folder, "files": []}
        files_out: list[dict] = []
        for p in sorted(dest_dir.iterdir()):
            if p.is_file():
                try:
                    st = p.stat()
                    files_out.append({"name": p.name, "size": st.st_size})
                except OSError:
                    continue
        return {"user_folder": user_folder, "topic_folder": folder, "files": files_out}

    @app.delete("/rag/files")
    async def delete_topic_file(user_id: str, topic: str, filename: str):
        """Remove one file and rebuild that user’s topic index."""
        user_folder = sanitize_user_id(user_id)
        folder = sanitize_topic_folder(topic)
        name = safe_filename(filename)
        base = (DOCUMENTS_ROOT / user_folder / "uploads" / folder).resolve()
        dest = (base / name).resolve()
        try:
            dest.relative_to(base)
        except ValueError:
            raise HTTPException(status_code=404, detail="File not found")
        if not dest.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        dest.unlink()

        topic_index = DOCUMENTS_ROOT / user_folder / "faiss_index" / folder
        if topic_index.exists():
            shutil.rmtree(topic_index, ignore_errors=True)

        count = rag_service.index_documents(user_folder=user_folder, topic_folder=folder)
        return {
            "removed": name,
            "user_folder": user_folder,
            "topic_folder": folder,
            "reindexed_chunks": count,
        }

    @app.delete("/rag/topic")
    async def delete_topic(user_id: str, topic: str):
        """
        Remove all uploads and the FAISS index for one study topic under this user.
        Idempotent: missing folders are treated as already gone.
        """
        user_folder = sanitize_user_id(user_id)
        folder = sanitize_topic_folder(topic)
        uploads_topic = DOCUMENTS_ROOT / user_folder / "uploads" / folder
        index_topic = DOCUMENTS_ROOT / user_folder / "faiss_index" / folder
        removed_uploads = uploads_topic.exists()
        removed_index = index_topic.exists()
        if removed_uploads:
            shutil.rmtree(uploads_topic, ignore_errors=True)
        if removed_index:
            shutil.rmtree(index_topic, ignore_errors=True)
        return {
            "status": "deleted",
            "user_folder": user_folder,
            "topic_folder": folder,
            "had_uploads": removed_uploads,
            "had_index": removed_index,
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)