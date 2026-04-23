import os
from pathlib import Path

from dotenv import load_dotenv

# Anchor to file location, not cwd: developers start uvicorn from `backend/` while
# `.env` lives at repo root—Path(__file__).parents[1] is stable across both layouts.
_env = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_env)
load_dotenv()  # Second pass: pick up shell-exported vars when `.env` is absent (CI).

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    # Fail fast at import: misconfigured agents should not silently run with a null key.
    raise ValueError("GEMINI_API_KEY is not set in .env")

# Default to a broadly available flash-tier model; override when a region/account lists a different id.
GEMINI_MODEL = (os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip()