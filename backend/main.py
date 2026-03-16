from __future__ import annotations

"""
Minimal FastAPI stub for ScholarAI backend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


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

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)