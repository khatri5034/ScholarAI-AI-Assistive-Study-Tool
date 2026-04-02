"""
Dense embeddings for retrieval.

Why sentence-transformers + bge-small-en: solid quality/size tradeoff for a student
project; runs locally without paid API keys.

Why load once at import: amortizes model load cost across many encode calls (upload +
query). For serverless, switch to lazy load.
"""

from sentence_transformers import SentenceTransformer

_model = SentenceTransformer("BAAI/bge-small-en")


def embed_texts(texts):
    if not texts:
        return []

    embeddings = _model.encode(
        texts,
        normalize_embeddings=True  
    )

    return embeddings.tolist()