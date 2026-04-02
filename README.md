# ScholarAI — Agentic Study Assistant

AI-powered study companion: **per-user, per-topic** document uploads, **RAG** indexing (FAISS + local embeddings), and a **Next.js** app with **Firebase Auth**, topic workflow, and hooks for chat, planner, and quiz.

## What’s implemented today

- **Auth**: Email/password and Google sign-in (Firebase); profile (display name, email/password flows where applicable).
- **Study topics**: Users pick a course/topic on Home; topic is stored in context + `localStorage` (keyed by Firebase `uid`). Recent topics list; **remove topic** deletes server files + index and drops the topic from history.
- **Uploads**: PDF, TXT, Word, PowerPoint → `POST /rag/upload-multiple` with `user_id`, `topic`, then `POST /rag/index` to rebuild that topic’s index.
- **Files**: List/remove files per topic (`GET` / `DELETE /rag/files`); removing a file triggers reindex for that topic.
- **RAG backend**: Chunking, `sentence-transformers` (BAAI/bge-small-en), FAISS (`IndexFlatIP` + L2-normalized vectors), JSON sidecar for chunk text.
- **Planner / Quiz / Chat UI**: Shell pages and components; chat can be wired to `POST /rag/query` with `user_id` + `topic` to match stored indexes.

## How data is stored on disk

Run the API from the **`backend/`** directory so relative paths resolve as expected.

```
documents/
└── <firebase_uid>/
    ├── uploads/
    │   └── <sanitized_topic>/     # uploaded files for that topic
    └── faiss_index/
        └── <sanitized_topic>/     # index.faiss + texts.json
```

Indexing **without** a `topic` query param builds a combined index under `faiss_index/__all__/` for that user’s entire `uploads/` tree.

**Security note:** The API accepts `user_id` from the client. For production, verify a Firebase ID token on the server and derive the uid from it instead of trusting the request body.

## Project structure

```
ScholarAI-AI-Assistive-Study-Tool/
├── frontend/                 # Next.js (App Router)
│   ├── app/                  # Routes: /, /login, /signup, /profile, /chat, /upload, /planner, /quiz, /privacy, …
│   ├── components/           # Navbar, UploadZone, TopicGuard, HomePageClient, TopicFilesModal, …
│   ├── contexts/             # StudyTopicProvider (topic + history per uid)
│   ├── hooks/                # useChat, usePlanner (stubs / future API wiring)
│   ├── services/             # firebase.ts, api.ts
│   ├── styles/               # globals.css
│   └── public/
├── backend/
│   ├── main.py               # FastAPI app: /rag/* routes, CORS
│   ├── services/
│   │   ├── rag.py            # Orchestrates load → chunk → embed → FAISS
│   │   ├── loader.py         # PDF / txt / docx / pptx extraction
│   │   ├── chunking.py
│   │   ├── embedding.py      # sentence-transformers
│   │   └── vector_store.py   # FAISS persistence
│   ├── api/                  # Reserved for future route modules
│   ├── agents/               # Reserved for planner / quiz agents
│   ├── models/               # Reserved for LLM clients
│   └── requirements.txt
├── database/                 # Optional PostgreSQL schema (not required for file+RAG MVP)
│   ├── schema.sql
│   └── seed_data.sql
├── config/
│   └── .env.example          # Example env vars (root / shared)
└── README.md
```

## HTTP API (backend)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Health check |
| `POST` | `/rag/upload` | Single file + `topic` + `user_id` (form) |
| `POST` | `/rag/upload-multiple` | Multiple files + `topic` + `user_id` (form) |
| `POST` | `/rag/index?user_id=&topic=` | Rebuild index for one topic (`topic` optional → `__all__`) |
| `POST` | `/rag/query` | JSON: `question`, `user_id`, optional `topic`, `top_k` |
| `GET` | `/rag/files?user_id=&topic=` | List files for a topic |
| `DELETE` | `/rag/files?user_id=&topic=&filename=` | Delete one file + reindex topic |
| `DELETE` | `/rag/topic?user_id=&topic=` | Delete topic uploads + FAISS folder |

## Quick start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
# If indexing fails on missing packages, also install:
#   pip install faiss-cpu python-docx python-pptx numpy
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The first run may download the **BAAI/bge-small-en** model (sentence-transformers) and can take a minute.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Configure Firebase in `frontend/services/firebase.ts` (web app config from the Firebase console).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). After login, users are sent **Home** to choose a topic, then **Chat / Upload / Planner / Quiz** unlock.

### Optional: PostgreSQL

For metadata, plans, or multi-user tables later:

```bash
createdb scholarai
psql -d scholarai -f database/schema.sql
```

Copy `config/.env.example` to `.env` and set `DATABASE_URL` when you connect the backend to Postgres.

## Configuration

| Area | Location / variables |
|------|----------------------|
| API base URL | `frontend/.env.local` → `NEXT_PUBLIC_API_URL` |
| Firebase | `frontend/services/firebase.ts` |
| Backend secrets (future) | `config/.env.example` → `OPENAI_API_KEY`, `DATABASE_URL`, etc. |
| TypeScript paths | `frontend/tsconfig.json` → `baseUrl` + `paths` (`@/*`) |

## Tech stack

- **Frontend**: Next.js 16, React 18, Tailwind CSS, Firebase Auth / Firestore (signup user doc)
- **Backend**: FastAPI, Uvicorn, python-multipart, sentence-transformers, PyTorch, FAISS, pypdf
- **Embeddings**: Local **BAAI/bge-small-en** (no OpenAI key required for retrieval MVP)
- **Database**: PostgreSQL schema provided; optional for the current file+RAG flow

## Development notes

- **CORS** is open (`*`) for local dev; tighten for production.
- **Login** redirects to **`/`** (home), not the login page.
- **Topic guard**: Authenticated users without a topic are redirected to Home (`#choose-topic`) from gated routes.

---

Built for a clear capstone story: sign in → choose topic → upload → index → ask questions grounded in *your* materials.
