# ScholarAI — Agentic Study Assistant

AI-powered study assistant with **RAG** (course material Q&A), **study planning**, and future **audio** (TTS/STT). Built for clarity and capstone presentation.

## Project structure

```
scholar-ai/
├── frontend/          # Next.js App (UI)
│   ├── app/           # Pages & layouts
│   ├── components/    # Reusable UI (ChatBox, StudyPlanner)
│   ├── styles/        # CSS / Tailwind
│   ├── hooks/         # useChat, usePlanner
│   ├── services/      # API calls to backend
│   └── public/
├── backend/           # API + AI (Python)
│   ├── api/           # Routes: /chat, /plan, /upload
│   ├── rag/           # RAG pipeline (retriever)
│   ├── agents/        # Planner Agent, etc.
│   ├── models/        # OpenAI / LLM integration
│   ├── db/            # Database connection
│   ├── utils/
│   └── main.py        # Entry point
├── database/          # Schema & migrations
│   ├── schema.sql
│   └── seed_data.sql
├── documents/         # Uploaded course material (pdfs, notes, slides)
├── embeddings/        # Vector store + embedding scripts
├── audio/             # Future: TTS, STT, voices
├── tests/             # Frontend & backend tests
├── config/            # .env.example, settings.py
└── README.md
```

## How it works

1. **Upload** → User uploads PDFs → stored in `documents/`.
2. **Embed** → Backend runs embedding pipeline → vectors in `embeddings/`.
3. **Chat** → User asks question → frontend → backend → **RAG** retrieves chunks → LLM answers.
4. **Plan** → User requests study plan → **Planner Agent** → plan saved in **database**.
5. **Audio** (later) → TTS/STT in `audio/`.

## Quick start

### Backend (Python)

```bash
cd backend
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
pip install -r ../requirements.txt
# Copy config/.env.example to .env and set OPENAI_API_KEY, DATABASE_URL
uvicorn main:create_app --reload --port 8000
```

### Frontend (Next.js)

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

### Database (PostgreSQL)

```bash
# Create database
createdb scholarai

# Apply schema (from project root)
psql -d scholarai -f database/schema.sql

# Or with full URL
psql postgresql://user:password@localhost:5432/scholarai -f database/schema.sql
```

## Config

- **Backend**: Copy `config/.env.example` to `config/.env` or set env vars (`OPENAI_API_KEY`, `DATABASE_URL`).
- **Frontend**: `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000`.

## Tech stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Python (FastAPI recommended), RAG, agents
- **Database**: PostgreSQL
- **Embeddings**: OpenAI (or local); vector store in `embeddings/`

---

Scalable, clean, and ready for implementation and capstone demo.
