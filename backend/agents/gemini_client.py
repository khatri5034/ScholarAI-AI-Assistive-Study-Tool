"""
Gemini wrapper isolated here so HTTP code never depends on SDK response shapes directly.

google-genai (not legacy google-generativeai) was chosen to track Google's current
client; one process-wide Client avoids repeated handshake overhead per chat message.
"""

from google import genai
from config.settings import GEMINI_API_KEY, GEMINI_MODEL

client = genai.Client(api_key=GEMINI_API_KEY)

# Hard cap: combined RAG + instructions can exceed provider limits; truncate beats a 413
# that surfaces to students as an opaque failure.
_MAX_PROMPT_CHARS = 950_000


def _extract_text_from_response(response: object) -> str | None:
    """SDK returns `text=None` on blocks / empty candidates; walking parts avoids brittle one-field access."""
    raw = getattr(response, "text", None)
    if raw is not None and str(raw).strip():
        return str(raw).strip()
    parts_out: list[str] = []
    for cand in getattr(response, "candidates", None) or []:
        content = getattr(cand, "content", None)
        if content is None:
            continue
        for part in getattr(content, "parts", None) or []:
            t = getattr(part, "text", None)
            if t:
                parts_out.append(str(t))
    if parts_out:
        return "\n".join(parts_out).strip()
    return None


def call_gemini(prompt: str) -> str:
    """
    Raise on unusable output so callers can map to `LLM_ERROR:` consistently instead of
    silently returning empty strings that look like successful model answers.
    """
    text_in = prompt if len(prompt) <= _MAX_PROMPT_CHARS else (
        prompt[: _MAX_PROMPT_CHARS - 200]
        + "\n\n[… prompt truncated for API limits …]"
    )
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=text_in,
        )
    except Exception as e:
        raise ValueError(f"Gemini API request failed ({GEMINI_MODEL}): {e}") from e

    out = _extract_text_from_response(response)
    if out:
        return out

    fb = getattr(response, "prompt_feedback", None)
    reason = getattr(fb, "block_reason", None) if fb is not None else None
    raise ValueError(
        "No text in model response (safety block, empty candidates, or non-text output). "
        f"block_reason={reason!r}. If this persists, try GEMINI_MODEL=gemini-2.0-flash in .env."
    )
