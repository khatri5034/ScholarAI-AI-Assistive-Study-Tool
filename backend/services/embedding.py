from sentence_transformers import SentenceTransformer

# Load model 
_model = SentenceTransformer("BAAI/bge-small-en")

def embed_texts(texts):
    """
    Convert list of texts into embeddings.
    """
    if not texts:
        return []

    embeddings = _model.encode(
        texts,
        normalize_embeddings=True  
    )

    return embeddings.tolist()