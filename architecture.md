# Offline-First Survival App: Complete Technology Stack & Architecture

## 1. Core Framework & UI
* **React Native (0.73+):** The foundational framework for cross-platform mobile development.
* **Expo (Development Builds):** Utilized for rapid development and over-the-air (OTA) updates. Standard Expo Go is bypassed to allow compilation of custom native code required for local machine learning and high-performance databases.
* **TypeScript:** Enforces strict type-safety across the application, particularly critical when mapping native database schemas to frontend interfaces.
* **Zustand:** A minimalist, hook-based state management library. Specifically used to manage the offline readiness state, download progress during the initial sync, and search query status.
* **@shopify/flash-list:** A highly optimized list rendering component, essential for maintaining a 60fps frame rate when displaying hundreds of vector-matched text excerpts.

## 2. Edge Vector Database (Storage & Retrieval)
* **ObjectBox:** An ultra-fast, NoSQL edge database chosen for its native, out-of-the-box vector search capabilities. It bypasses the need for complex C-extensions (like `sqlite-vec`) and operates directly on device storage.
* **Zero-Copy Architecture:** ObjectBox reads data directly from the device's storage into the application's memory without creating intermediate copies, ensuring sub-millisecond retrieval times even on budget hardware.
* **Data Model:** Data is structured as entities (e.g., `SurvivalTip`) containing raw text, metadata categories, and a Float32Array representing the vector embedding.

## 3. Local Machine Learning (Compute)
* **onnxruntime-react-native:** Microsoft's runtime execution engine. It allows the app to load and execute machine learning models directly on the device's CPU or Neural Processing Unit (NPU) without any cloud connectivity.
* **all-MiniLM-L6-v2 (ONNX Format):** A highly quantized, lightweight (~22MB) embedding model. It translates natural language search queries into dense mathematical vectors (384 dimensions) for similarity comparison.
* **Custom JavaScript Tokenizer:** A local implementation (e.g., ported WordPiece tokenizer) that converts the raw user string into integer IDs required by the ONNX model before inference.

## 4. File System & Networking (Data Ingestion)
* **expo-file-system:** Manages the downloading and local routing of the pre-computed database files and the `.onnx` model from the remote server to the device's secure document directory.
* **AWS S3 / Cloudflare R2:** Static asset hosting for the initial payload. The app downloads a zipped archive containing the pre-populated ObjectBox directory (`data.mdb`, `lock.mdb`) and the ML model upon first launch over Wi-Fi.

## 5. Three-Phase Data Flow Architecture

### Phase 1: The Build Pipeline (Server/Laptop)
1. **Parsing:** Raw survival data (Markdown/JSON) is chunked into logical segments.
2. **Embedding:** A backend script (Python/Node) processes these chunks through an embedding model to generate vectors.
3. **Ingestion:** The text and vectors are written into a local ObjectBox database directory.
4. **Distribution:** The `.mdb` files and the `model.onnx` file are bundled and uploaded to a static storage bucket.

### Phase 2: The Initial Sync (Online)
1. **Installation:** The user downloads the app shell via the App Store/Play Store.
2. **Hydration:** Upon first launch (requiring Wi-Fi), `expo-file-system` pulls the pre-computed ObjectBox directory and the ONNX model into the local device storage.
3. **Initialization:** The ObjectBox store and ONNX runtime session are instantiated using the newly downloaded assets.
4. **Offline Readiness:** Zustand updates the global state, indicating the app is fully functional without internet.

### Phase 3: The Emergency Query (100% Offline)
1. **Input:** The user enters a search query (e.g., "treat a snake bite").
2. **Tokenization:** The custom JS tokenizer converts the query into token IDs.
3. **Inference:** `onnxruntime-react-native` processes the tokens and outputs a 384-dimensional vector.
4. **Vector Search:** ObjectBox executes a nearest-neighbor search (`nearestNeighbors()`) comparing the query vector against the stored embeddings.
5. **Rendering:** The top matches are mapped to memory and rendered via FlashList.