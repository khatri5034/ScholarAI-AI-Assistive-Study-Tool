"""
Dense embeddings for retrieval.

bge-small-en: strong quality/size tradeoff on CPU laptops and no per-token billing.
Eager load at import: one cold start cost beats reloading the model on every upload in
this class-project footprint; serverless deployments would switch to lazy init instead.
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