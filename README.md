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

## Commands

- `npm run start`
- `npm run android`
- `npm run ios`
