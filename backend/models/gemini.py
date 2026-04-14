import os
from google import genai
from google.genai import errors

client = genai.Client(api_key = os.environ["GEMINI_API_KEY"])

SYSTEM_PROMPT = """You are ScholarAI, a helpful study assistant.
    Answer the student's question using ONLY the provided context excerpts from their uploaded materials.
    If the context does not contain enough information, say honestly — do not make things up.
    Be concise, clear, and helpful."""

def generate_answer(question: str, chunks: list[str]) -> str:
    if not chunks:
        return "I couldn't find relevant content in your uploads for that question. Try uploading more materials or rephrasing."

    context = "\n\n---\n\n".join(f"Excerpt {i+1}:\n{c}" for i, c in enumerate(chunks))

    prompt = f"""{SYSTEM_PROMPT}

        Student's question: {question}

        Context from student's uploaded materials:
        {context}

        Answer:"""

    try:
        response = client.models.generate_content(
            model = "gemini-3-flash-preview",
            contents = prompt,
        )

        return response.text.strip()
    except errors.APIError as e:
        if e.code == 429:
            return "Rate limit reached. Please wait a moment and try again."
        
        return f"Gemini API error: {str(e)}"
    except Exception as e:
        return f"Unexpected error generating answer: {str(e)}"