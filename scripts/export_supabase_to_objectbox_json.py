#!/usr/bin/env python3
"""Export Supabase rows into ObjectBox index JSON format.

This script pulls every row from a Supabase table (paged) and writes:
{
    "documents": [
        {
            "id": "tip-1::chunk-0::chunk-0",
            "source_id": "tip-1::chunk-0",
            "title": "...",
            "category": "...",
            "chunk_index": 0,
            "content": "...",
            "embedding": [0.1, 0.2, ...]
        }
    ]
}

It fetches all columns from the table, then maps only the required fields
(`title`, `content`, `embedding`) plus optional id/category fields.

Examples:
    python scripts/export_supabase_to_objectbox_json.py \
        --table survival_vectors \
        --output assets/objectbox/objectbox-index.json

    python scripts/export_supabase_to_objectbox_json.py \
        --table survival_vectors \
        --title-column headline \
        --content-column snippet \
        --embedding-column embedding_vector \
        --output assets/objectbox/objectbox-index.json

Environment variables used by default:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export Supabase table rows to objectbox-index.json format"
    )
    parser.add_argument(
        "--supabase-url",
        default=os.environ.get("SUPABASE_URL", ""),
        help="Supabase project URL (or set SUPABASE_URL)",
    )
    parser.add_argument(
        "--supabase-key",
        default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.environ.get("SUPABASE_ANON_KEY", ""),
        help="Supabase key (or set SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY)",
    )
    parser.add_argument(
        "--table",
        required=True,
        help="Supabase table name to export",
    )
    parser.add_argument("--output", required=True, help="Output JSON file path")
    parser.add_argument(
        "--page-size",
        type=int,
        default=1000,
        help="Rows to fetch per request (Supabase default max is commonly 1000)",
    )

    parser.add_argument(
        "--id-column",
        default="id,doc_id,document_id",
        help="Comma-separated candidate column names for base id",
    )
    parser.add_argument(
        "--source-id-column",
        default="source_id,parent_id",
        help="Comma-separated candidate column names for source_id",
    )
    parser.add_argument(
        "--title-column",
        default="title,name",
        help="Comma-separated candidate column names for title",
    )
    parser.add_argument(
        "--content-column",
        default="content,text,body,chunk",
        help="Comma-separated candidate column names for content",
    )
    parser.add_argument(
        "--embedding-column",
        default="embedding,vector",
        help="Comma-separated candidate column names for embedding",
    )
    parser.add_argument(
        "--category-column",
        default="category,topic",
        help="Comma-separated candidate column names for category",
    )
    parser.add_argument(
        "--chunk-index-column",
        default="chunk_index,chunk",
        help="Comma-separated candidate column names for chunk index",
    )
    parser.add_argument(
        "--default-category",
        default="general",
        help="Fallback category when not present in DB rows",
    )

    return parser.parse_args()


def split_candidates(value: str) -> List[str]:
    return [part.strip().lower() for part in value.split(",") if part.strip()]


def normalize_embedding(raw: Any) -> List[float]:
    if raw is None:
        return []

    if isinstance(raw, (list, tuple)):
        return [float(x) for x in raw]

    if isinstance(raw, (bytes, bytearray, memoryview)):
        try:
            raw = bytes(raw).decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ValueError("Embedding value is binary and not valid UTF-8 text.") from exc

    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []

        # Prefer strict JSON arrays first.
        try:
            decoded = json.loads(text)
            if isinstance(decoded, list):
                return [float(x) for x in decoded]
        except json.JSONDecodeError:
            pass

        # Fallback for forms like: [1,2,3] or {1,2,3} or 1,2,3
        text = text.replace("{", "[").replace("}", "]")
        if text.startswith("[") and text.endswith("]"):
            text = text[1:-1]

        parts = [p.strip() for p in text.split(",") if p.strip()]
        return [float(p) for p in parts]

    raise ValueError(f"Unsupported embedding value type: {type(raw)!r}")


def get_first_value(row: Mapping[str, Any], candidates: Iterable[str]) -> Optional[Any]:
    for key in candidates:
        if key in row and row[key] is not None:
            return row[key]
    return None


def build_ids(
    row: Mapping[str, Any],
    index: int,
    id_candidates: Iterable[str],
    source_id_candidates: Iterable[str],
) -> Dict[str, str]:
    raw_id = get_first_value(row, id_candidates)
    raw_source_id = get_first_value(row, source_id_candidates)

    if raw_id is not None:
        base = str(raw_id)
    elif raw_source_id is not None:
        base = str(raw_source_id)
    else:
        base = f"tip-{index + 1}"

    if raw_source_id is not None:
        source_id = str(raw_source_id)
    elif base.endswith("::chunk-0::chunk-0"):
        source_id = base[: -len("::chunk-0")]
    elif base.endswith("::chunk-0"):
        source_id = base
    else:
        source_id = f"{base}::chunk-0"

    if base.endswith("::chunk-0::chunk-0"):
        doc_id = base
    elif base.endswith("::chunk-0"):
        doc_id = f"{base}::chunk-0"
    else:
        doc_id = f"{base}::chunk-0::chunk-0"

    return {"id": doc_id, "source_id": source_id}


def row_to_document(
    row: Mapping[str, Any],
    index: int,
    id_candidates: Iterable[str],
    source_id_candidates: Iterable[str],
    title_candidates: Iterable[str],
    content_candidates: Iterable[str],
    embedding_candidates: Iterable[str],
    category_candidates: Iterable[str],
    chunk_index_candidates: Iterable[str],
    default_category: str,
) -> Dict[str, Any]:
    ids = build_ids(row, index, id_candidates, source_id_candidates)

    title = get_first_value(row, title_candidates)
    content = get_first_value(row, content_candidates)
    embedding_raw = get_first_value(row, embedding_candidates)
    category = get_first_value(row, category_candidates)
    chunk_index = get_first_value(row, chunk_index_candidates)

    if title is None:
        title = f"Untitled {index + 1}"
    if content is None:
        content = ""

    try:
        chunk_index_value = int(chunk_index) if chunk_index is not None else 0
    except (TypeError, ValueError):
        chunk_index_value = 0

    return {
        "id": ids["id"],
        "source_id": ids["source_id"],
        "title": str(title),
        "category": str(category) if category is not None else default_category,
        "chunk_index": chunk_index_value,
        "content": str(content),
        "embedding": normalize_embedding(embedding_raw),
    }


def fetch_rows(supabase_url: str, supabase_key: str, table: str, page_size: int) -> List[Dict[str, Any]]:
    if not supabase_url:
        raise ValueError("Missing Supabase URL. Provide --supabase-url or SUPABASE_URL.")
    if not supabase_key:
        raise ValueError(
            "Missing Supabase key. Provide --supabase-key or SUPABASE_SERVICE_ROLE_KEY."
        )
    if page_size <= 0:
        raise ValueError("--page-size must be greater than zero.")

    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError("supabase is required. Install with: pip install supabase") from exc

    client = create_client(supabase_url, supabase_key)

    all_rows: List[Dict[str, Any]] = []
    offset = 0
    while True:
        response = (
            client.table(table)
            .select("*")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            break

        all_rows.extend({str(k).lower(): v for k, v in row.items()} for row in rows)

        if len(rows) < page_size:
            break
        offset += page_size

    return all_rows


def write_output(output_path: Path, documents: List[Dict[str, Any]]) -> None:
    payload = {"documents": documents}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()

    id_candidates = split_candidates(args.id_column)
    source_id_candidates = split_candidates(args.source_id_column)
    title_candidates = split_candidates(args.title_column)
    content_candidates = split_candidates(args.content_column)
    embedding_candidates = split_candidates(args.embedding_column)
    category_candidates = split_candidates(args.category_column)
    chunk_index_candidates = split_candidates(args.chunk_index_column)

    rows = fetch_rows(
        supabase_url=args.supabase_url,
        supabase_key=args.supabase_key,
        table=args.table,
        page_size=args.page_size,
    )
    documents = [
        row_to_document(
            row=row,
            index=index,
            id_candidates=id_candidates,
            source_id_candidates=source_id_candidates,
            title_candidates=title_candidates,
            content_candidates=content_candidates,
            embedding_candidates=embedding_candidates,
            category_candidates=category_candidates,
            chunk_index_candidates=chunk_index_candidates,
            default_category=args.default_category,
        )
        for index, row in enumerate(rows)
    ]

    output_path = Path(args.output)
    write_output(output_path, documents)
    print(f"Exported {len(documents)} records to {output_path}")


if __name__ == "__main__":
    main()
