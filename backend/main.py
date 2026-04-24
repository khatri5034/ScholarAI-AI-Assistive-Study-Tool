from __future__ import annotations

import sys
from pathlib import Path

# Monorepo: `uvicorn` runs with cwd=`backend/`, but `config` and `agents` live next to
# `backend/` at repo root—prepend that parent so imports work without `pip install -e .`.
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

"""
ScholarAI HTTP API.

Single module by choice: small surface area and one place to read auth/RAG policy until
routers would actually reduce noise. Firebase already authenticates users in the
browser; we accept `user_id` from the client for the MVP to avoid duplicating token
verification in Python—tighten before production (see README security section).
"""

import re
import shutil

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

from services.rag import RAGService, format_rag_context

def sanitize_topic_folder(topic: str) -> str:
    """
    Topics become directory names on disk; strict mapping prevents `../` escapes and
    keeps one human label ↔ one folder without shell-unfriendly characters.
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
    Firebase uid shape is predictable; an allowlist beats blacklists so arbitrary strings
    can never become path segments outside `documents/<uid>/`.
    """
    raw = (user_id or "").strip()
    if not raw or not re.match(r"^[A-Za-z0-9_-]{1,128}$", raw):
        raise HTTPException(status_code=400, detail="user_id is invalid or missing")
    return raw


def safe_filename(name: str | None) -> str:
    """Basename only: uploaded names may contain `../../`; we never trust client paths."""
    if not name:
        raise HTTPException(status_code=400, detail="filename is required")
    return Path(name).name


class AgentRunRequest(BaseModel):
    message: str = Field(..., min_length=1)
    user_id: str
    topic: str
    mode: str = "auto"
    # When mode is "quiz": "mcq" = all multiple choice; "short_answer" = all written responses.
    quiz_format: str | None = None


def _parse_agent_text(raw: str) -> tuple[str, str]:
    """Split `[INTENT]\\n\\nbody` from multi_agents.orchestrator output."""
    if raw.startswith("[") and "]" in raw:
        end = raw.index("]")
        intent = raw[1:end].lower()
        body = raw[end + 1 :].lstrip("\n")
        return intent, body
    return "unknown", raw


def create_app() -> FastAPI:
    app = FastAPI(title="ScholarAI API")

    # Permissive during dev (Vite/Next ports, tunnels); replace with explicit origins in prod.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Relative to cwd on purpose: README standardizes running from `backend/` so data
    # stays next to the app without extra env for a storage root in student setups.
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
        top_k = int(payload.get("top_k", 6))

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
        from agents.multi_agents import answer_agent

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

        context = format_rag_context(chunks)
        answer = answer_agent(question, user_folder, folder or "", context)

        return {
            "question": question,
            "answer": answer,
            "chunks": chunks,
        }

    # ------------------------
    # Multi-agent (Gemini + RAG context)
    # ------------------------
    @app.post("/agents/run")
    async def agents_run(body: AgentRunRequest):
        """
        Lazy-import agents so import-time failures (Gemini config, optional RAG) do not
        block unrelated routes like `/rag/upload` during local bring-up.
        """
        from agents.multi_agents import (
            answer_agent,
            chat_agent,
            evaluator_agent,
            get_context,
            get_context_for_planner,
            orchestrator,
            plan_chat_agent,
            planner_agent,
            planner_week_agent,
            quiz_agent,
            quiz_explain_agent,
        )

        user_folder = sanitize_user_id(body.user_id)
        topic_folder = sanitize_topic_folder(body.topic)
        msg = body.message.strip()
        mode = (body.mode or "auto").strip().lower()
        # Tighter RAG budget for modes that paste long instructions + many chunks—reduces
        # timeouts and empty Gemini replies vs stuffing the same window as chat.
        _long_prompt_modes = frozenset({"planner", "planner_week", "quiz"})
        # `answer`/`chat` differ in multi_agents: answer is grounded; chat is lighter policy.
        allowed = {
            "auto",
            "chat",
            "answer",
            "planner",
            "planner_week",
            "plan_chat",
            "quiz",
            "quiz_explain",
            "evaluate",
        }
        if mode not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"mode must be one of: {', '.join(sorted(allowed))}",
            )

        handlers = {
            "chat": chat_agent,
            "answer": answer_agent,
            "planner": planner_agent,
            "planner_week": planner_week_agent,
            "plan_chat": plan_chat_agent,
            "quiz": quiz_agent,
            "quiz_explain": quiz_explain_agent,
            "evaluate": evaluator_agent,
        }

        if mode == "auto":
            raw = orchestrator(msg, user_folder, topic_folder)
            ctx = get_context(msg, user_folder, topic_folder)
        else:
            context = (
                get_context_for_planner(msg, user_folder, topic_folder)
                if mode in _long_prompt_modes
                else get_context(msg, user_folder, topic_folder)
            )
            ctx = context
            fn = handlers.get(mode, answer_agent)
            if mode == "quiz":
                qf = (body.quiz_format or "").strip().lower()
                if qf and qf not in ("mcq", "short_answer"):
                    raise HTTPException(
                        status_code=400,
                        detail="quiz_format must be 'mcq' or 'short_answer' when set.",
                    )
                response = quiz_agent(
                    msg,
                    user_folder,
                    topic_folder,
                    context,
                    quiz_format=qf or None,
                )
            else:
                response = fn(msg, user_folder, topic_folder, context)
            raw = f"[{mode.upper()}]\n\n{response}"

        rag_used = ctx is not None
        intent, answer = _parse_agent_text(raw)
        error_detail: str | None = None
        err: str | None = None
        # Prefix contract: agents return text, not HTTP exceptions; main normalizes errors
        # for the frontend without importing Gemini exception types here.
        if answer.startswith("LLM_ERROR:"):
            error_detail = answer[len("LLM_ERROR:") :].strip()[:4000]
            answer = ""
            err = "LLM_ERROR"
        elif answer.strip() == "AI error. Try again.":
            err = "LLM_ERROR"
            error_detail = "Model request failed (legacy error)."
            answer = ""
        elif not answer.strip():
            err = "LLM_ERROR"
            error_detail = "Empty model response."

        return {
            "intent": intent,
            "answer": answer,
            "rag_used": rag_used,
            "error": err,
            "error_detail": error_detail,
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
            # Even with `safe_filename`, resolve+relative_to guards symlink oddities.
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