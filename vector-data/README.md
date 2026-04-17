# Vector Data

This folder documents the vector-data ingestion pipeline for survival tips.

## Pipeline

1. Load source documents from Exa:
   - `npm run ingest:exa -- --query "wilderness survival first aid shelter water purification" --num-results 12 --category survival`
2. Transform large source documents into smaller tip snippets:
   - `npm run transform:exa`
3. Generate embeddings for local vector search:
   - `npm run embed:tips`
4. Push transformed tips into Supabase:
   - `npm run db:push:tips`

## End-to-end Command

- `npm run pipeline:tips`

## Generated Data Files

- `assets/objectbox/exa-corpus.json` (load layer)
- `assets/objectbox/exa-tip-snippets.json` (transform layer)
- `assets/objectbox/objectbox-index.embedded.json` (embedded vector index)

