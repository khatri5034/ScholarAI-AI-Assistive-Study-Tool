"""
OpenAI wrapper isolated here so HTTP code never depends on SDK response shapes directly.
"""

from openai import OpenAI
from config.settings import OPENAI_API_KEY, OPENAI_MODEL

client = OpenAI(api_key=OPENAI_API_KEY)

# Hard cap: combined RAG + instructions can exceed provider limits; truncate beats a 413
# that surfaces to students as an opaque failure.
_MAX_PROMPT_CHARS = 950_000


def _extract_text_from_response(response: object) -> str | None:
    """Responses API primary path + fallbacks for SDK shape differences."""
    output_text = getattr(response, "output_text", None)
    if output_text and str(output_text).strip():
        return str(output_text).strip()

    # Fallback if a different endpoint shape appears.
    choices = getattr(response, "choices", None) or []
    if choices:
        msg = getattr(choices[0], "message", None)
        content = getattr(msg, "content", None) if msg is not None else None
        if isinstance(content, str) and content.strip():
            return content.strip()

    return None


def call_model(prompt: str) -> str:
    """
    Raise on unusable output so callers can map to `LLM_ERROR:` consistently instead of
    silently returning empty strings that look like successful model answers.
    """
    text_in = prompt if len(prompt) <= _MAX_PROMPT_CHARS else (
        prompt[: _MAX_PROMPT_CHARS - 200]
        + "\n\n[… prompt truncated for API limits …]"
    )
    try:
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {
                    "role": "system",
                    "content": "You are a helpful study assistant.",
                },
                {
                    "role": "user",
                    "content": text_in,
                },
            ],
            temperature=0.2,
        )
    except Exception as e:
        raise ValueError(f"OpenAI API request failed ({OPENAI_MODEL}): {e}") from e

    out = _extract_text_from_response(response)
    if out:
        return out
    raise ValueError(
        "No text in model response (empty choices or non-text output). "
        "If this persists, verify OPENAI_MODEL and API key permissions."
    )
