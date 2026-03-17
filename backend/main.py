from __future__ import annotations

"""
Minimal FastAPI stub for ScholarAI backend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

    @app.get("/rag/query")
    async def rag_query(q: str, top_k: int = 5):
        chunks = rag_service.query(q, top_k=top_k)
        return {"question": q, "chunks": chunks}

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)