# LocalVectorDB

Expo React Native (JavaScript) bootstrap for an offline-first local semantic search app.

## What is included

- Initial sync/download flow with fallback bundled assets
- Local path conventions under `FileSystem.documentDirectory/offline-assets`
- Zustand app state for sync status and result list
- ObjectBox store bootstrap and vector repository placeholder
- Mobile ONNX text embedding inference (`onnxruntime-react-native`) with WordPiece tokenizer from `vocab.txt`
- One-time Python precompute utility for chunking and embedding JSON corpora
- Sync and Search screens with FlashList results

## Replace placeholders

Update `app.json` under `expo.extra.sync` with real URLs and checksums.
Replace placeholder files:

- `assets/objectbox/data.mdb`
- `assets/objectbox/lock.mdb`
- `assets/objectbox/objectbox-index.json`
- `assets/models/all-MiniLM-L6-v2.onnx`
- `assets/models/vocab.txt` (must match the ONNX model tokenizer)

Set `expo.extra.sync.enableNativeOnnx` to `true` for real on-device inference.

## Precompute corpus embeddings (one-time)

Install Python deps:

- `pip install sentence-transformers`

Generate an embedded corpus JSON:

- `python scripts/precompute_embeddings.py --input assets/objectbox/objectbox-index.json --output assets/objectbox/objectbox-index.embedded.json`

Use the produced file as the index payload for sync/bundled assets.

## Export Supabase Table to ObjectBox JSON

Install the DB dependency:

- `pip install supabase`

Export all rows from a Supabase table into the same `objectbox-index.json` structure:

- `python scripts/export_supabase_to_objectbox_json.py --table survival_vectors --output assets/objectbox/objectbox-index.json`

Notes:

- If you omit credentials flags, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your environment.
- The script fetches all columns from Supabase, then maps only the required fields (`embedding`, `title`, `content`) plus optional id/category fields.
- If your column names differ, pass `--embedding-column`, `--title-column`, and `--content-column`.

## Scrape survival guides into JSON

Install the scraping deps:

- `pip install requests beautifulsoup4`

Scrape one or more guide pages directly:

- `python backend/loaders/scrape_survival_guides.py --url https://example.com/survival-guide --output backend/loaders/output/survival-guides.json`

Discover likely survival-guide links from an index page, then scrape them:

- `python backend/loaders/scrape_survival_guides.py --index-url https://example.com/guides --allowed-domain example.com --limit 10 --output backend/loaders/output/survival-guides.json`

Combine direct URLs with a text or JSON input file:

- `python backend/loaders/scrape_survival_guides.py --input backend/loaders/seed-urls.txt --url https://example.com/water-purification --source-name example.com --category wilderness --output backend/loaders/output/survival-guides.json`

The scraper writes a JSON payload with `schema_version`, `generated_at`, and a `documents` list containing normalized page text, headings, links, images, and basic parser metadata. By default, index discovery uses a survival-focused link heuristic; pass `--link-pattern` to override it.

## Commands

- `npm run start`
- `npm run android`
- `npm run ios`
