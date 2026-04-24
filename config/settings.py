import os
from pathlib import Path

from dotenv import load_dotenv

# Anchor to file location, not cwd: developers start uvicorn from `backend/` while
# `.env` lives at repo root—Path(__file__).parents[1] is stable across both layouts.
_env = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_env, override=True)
load_dotenv()  # Second pass: pick up shell-exported vars when `.env` is absent (CI).

OPENAI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    # Fail fast at import: misconfigured agents should not silently run with a null key.
    raise ValueError("OPENAI_API_KEY is not set in .env (or fallback GEMINI_API_KEY)")

# Default to a fast, low-cost chat model; override per account/policy.
OPENAI_MODEL = (os.getenv("OPENAI_MODEL") or os.getenv("GEMINI_MODEL") or "gpt-5.4-mini").strip()