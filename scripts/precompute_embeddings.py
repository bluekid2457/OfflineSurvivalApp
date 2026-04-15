#!/usr/bin/env python3
"""Create chunked embedding JSON for local mobile vector search.

Example:
python scripts/precompute_embeddings.py \
  --input assets/objectbox/objectbox-index.json \
  --output assets/objectbox/objectbox-index.embedded.json
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, Iterable, List


def sentence_chunks(text: str, max_chars: int, overlap_chars: int) -> List[str]:
    """Chunk text into sentence-preserving windows with overlap."""
    clean = re.sub(r"\s+", " ", (text or "").strip())
    if not clean:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", clean)
    chunks: List[str] = []
    current = ""

    for sentence in sentences:
        if not sentence:
            continue

        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) <= max_chars:
            current = candidate
            continue

        if current:
            chunks.append(current)

        if len(sentence) <= max_chars:
            current = sentence
        else:
            # Hard-wrap long sentence.
            for start in range(0, len(sentence), max_chars):
                end = start + max_chars
                part = sentence[start:end].strip()
                if part:
                    chunks.append(part)
            current = ""

    if current:
        chunks.append(current)

    if overlap_chars <= 0 or len(chunks) < 2:
        return chunks

    with_overlap: List[str] = []
    for index, chunk in enumerate(chunks):
        if index == 0:
            with_overlap.append(chunk)
            continue
        tail = chunks[index - 1][-overlap_chars:]
        with_overlap.append(f"{tail} {chunk}".strip())

    return with_overlap


def load_documents(input_path: Path) -> List[Dict]:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    docs = payload.get("documents")
    if not isinstance(docs, list):
        raise ValueError("Input JSON must be either a list or {\"documents\": [...]} format")
    return docs


def embed_documents(
    documents: Iterable[Dict],
    model_name: str,
    max_chars: int,
    overlap_chars: int,
    normalize_embeddings: bool,
) -> List[Dict]:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer(model_name)

    output_docs: List[Dict] = []
    for doc in documents:
        source_id = str(doc.get("id", "unknown"))
        title = str(doc.get("title", "Untitled"))
        category = str(doc.get("category", "general"))
        content = str(doc.get("content", ""))

        chunks = sentence_chunks(content, max_chars=max_chars, overlap_chars=overlap_chars) or [content]

        texts_to_embed = [f"{title}\n\n{chunk}".strip() for chunk in chunks]
        vectors = model.encode(
            texts_to_embed,
            normalize_embeddings=normalize_embeddings,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

        for index, (chunk, vector) in enumerate(zip(chunks, vectors)):
            output_docs.append(
                {
                    "id": f"{source_id}::chunk-{index}",
                    "source_id": source_id,
                    "title": title,
                    "category": category,
                    "chunk_index": index,
                    "content": chunk,
                    "embedding": [float(x) for x in vector.tolist()],
                }
            )

    return output_docs


def write_output(output_path: Path, docs: List[Dict]) -> None:
    payload = {"documents": docs}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Chunk and embed a JSON corpus for LocalVectorDB")
    parser.add_argument("--input", required=True, help="Input JSON file path")
    parser.add_argument("--output", required=True, help="Output JSON file path")
    parser.add_argument("--model", default="sentence-transformers/all-MiniLM-L6-v2", help="SentenceTransformer model")
    parser.add_argument("--max-chars", type=int, default=420, help="Max chars per chunk")
    parser.add_argument("--overlap-chars", type=int, default=60, help="Char overlap between adjacent chunks")
    parser.add_argument(
        "--no-normalize",
        action="store_true",
        help="Disable L2 normalization for produced embeddings",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)

    documents = load_documents(input_path)
    embedded = embed_documents(
        documents,
        model_name=args.model,
        max_chars=args.max_chars,
        overlap_chars=args.overlap_chars,
        normalize_embeddings=not args.no_normalize,
    )
    write_output(output_path, embedded)

    print(f"Embedded {len(embedded)} chunks -> {output_path}")


if __name__ == "__main__":
    main()
