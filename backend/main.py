from __future__ import annotations

"""
Minimal FastAPI stub for ScholarAI backend.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import shutil
from pathlib import Path

from services.rag import RAGService


def create_app() -> FastAPI:
    app = FastAPI(title="ScholarAI API")

    # Enable CORS so frontend (Next.js) can call backend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # restrict later in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/status")
    async def health():
        return {
            "status": "ok",
            "message": "ScholarAI backend running"
        }

    rag_service = RAGService(
        uploads_dir="backend/data/uploads",
        index_dir="backend/data/faiss_index",
    )

    @app.post("/rag/index")
    async def build_rag_index():
        count = rag_service.index_documents()
        return {"indexed_chunks": count}
    
    ALLOWED_EXTENSIONS = {".pdf", ".txt", ".doc", ".docx", ".ppt", ".pptx"}

    @app.post("/rag/upload")
    async def upload_file(file: UploadFile = File(...)):
        extension = Path(file.filename).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported file type '{extension}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )
        file_location = Path("backend/data/uploads")
        file_location.mkdir(parents = True, exist_ok = True)

        dest = file_location / file.filename
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        count = rag_service.index_documents()
        return {"filename": file.filename, 
                "status": "uploaded", 
                "indexed_chunks": count}
    
    @app.post("/rag/upload-multiple")
    async def upload_files(files: list[UploadFile] = File(...)):
        results = []
        errors = []

        for file in files:
            extension = Path(file.filename).suffix.lower()
            if extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unsupported file type '{extension}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
                )

            file_location = Path("backend/data/uploads")
            file_location.mkdir(parents = True, exist_ok = True)

            dest = file_location / file.filename
            with dest.open("wb") as f:
                shutil.copyfileobj(file.file, f)

            results.append(file.filename)

        # Index all at once after all files are saved
        count = rag_service.index_documents()

        return {
            "uploaded": results,
            "errors": errors,
            "indexed_chunks": count,
        }

    @app.get("/rag/query")
    async def rag_query(q: str, top_k: int = 5):
        chunks = rag_service.query(q, top_k=top_k)
        return {"question": q, "chunks": chunks}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)