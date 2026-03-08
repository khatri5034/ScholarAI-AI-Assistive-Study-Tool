"""
Central settings — load from env (e.g. OPENAI_API_KEY, DATABASE_URL).
Used by backend main.py, api, rag, agents, db.
"""
import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/scholarai")
PORT = int(os.getenv("PORT", "8000"))
