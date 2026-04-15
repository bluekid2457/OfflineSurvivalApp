import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

let storeInstance = null;
let nativeObjectBox = undefined;

function isNativeObjectBoxEnabled() {
  return Boolean(Constants.expoConfig?.extra?.sync?.enableNativeObjectBox);
}

async function loadNativeObjectBox() {
  if (nativeObjectBox !== undefined) {
    return nativeObjectBox;
  }

  if (!isNativeObjectBoxEnabled()) {
    nativeObjectBox = null;
    return null;
  }

  try {
    const runtimeRequire = globalThis?.require || require;
    const moduleName = ['@objectbox', 'react-native'].join('/');
    nativeObjectBox = runtimeRequire(moduleName);
    return nativeObjectBox;
  } catch {
    nativeObjectBox = null;
    return null;
  }
}

async function ensureObjectBoxFiles(directoryPath) {
  const [dataInfo, lockInfo] = await Promise.all([
    FileSystem.getInfoAsync(`${directoryPath}/data.mdb`),
    FileSystem.getInfoAsync(`${directoryPath}/lock.mdb`),
  ]);

  if (!dataInfo.exists || !lockInfo.exists) {
    throw new Error('ObjectBox files are missing. Expected data.mdb and lock.mdb in the ObjectBox directory.');
  }
}

export async function initializeObjectBoxStore({ directoryPath, indexFileUri }) {
  if (storeInstance) {
    return storeInstance;
  }

  if (!directoryPath) {
    throw new Error('ObjectBox directory path is required.');
  }

  await ensureObjectBoxFiles(directoryPath);

  const native = await loadNativeObjectBox();

  if (native?.openStore) {
    storeInstance = await native.openStore({ directory: directoryPath });
    return storeInstance;
  }

  storeInstance = {
    kind: 'filesystem-fallback',
    directoryPath,
    indexFileUri,
  };

  return storeInstance;
}

export function getObjectBoxStore() {
  if (!storeInstance) {
    throw new Error('ObjectBox store not initialized. Run sync before querying.');
  }

  return storeInstance;
}

function deterministicVector(text, dimensions = 384) {
  const vector = new Float32Array(dimensions);
  const value = String(text || '');

  for (let index = 0; index < value.length; index += 1) {
    const slot = index % dimensions;
    vector[slot] += ((value.charCodeAt(index) % 29) - 14) / 100;
  }

  return vector;
}

function normalizeDocument(raw, fallbackIndex) {
  const hasRealEmbedding = Array.isArray(raw?.embedding) && raw.embedding.length > 0;
  const seed = `${raw?.title || ''}\n${raw?.content || ''}`;
  const embedding = hasRealEmbedding
    ? raw.embedding
    : Array.from(deterministicVector(seed));

  return {
    id: String(raw?.id ?? fallbackIndex + 1),
    title: raw?.title || `Offline Note ${fallbackIndex + 1}`,
    content: raw?.content || 'No content available.',
    embedding,
    _hasRealEmbedding: hasRealEmbedding,
    category: raw?.category || 'general',
  };
}

export async function readObjectBoxDocuments() {
  const store = getObjectBoxStore();

  if (store.kind !== 'filesystem-fallback' && typeof store.getAll === 'function') {
    const rows = await store.getAll('SurvivalTip');
    return rows.map((row, index) => normalizeDocument(row, index));
  }

  const indexInfo = await FileSystem.getInfoAsync(store.indexFileUri);

  if (!indexInfo.exists) {
    return [
      {
        id: 'fallback-1',
        title: 'ObjectBox Ready',
        content: 'ObjectBox files were hydrated, but no objectbox-index.json manifest was found. Add exported records for richer results.',
        embedding: Array.from(deterministicVector('ObjectBox Ready')),
        category: 'system',
      },
    ];
  }

  try {
    const text = await FileSystem.readAsStringAsync(store.indexFileUri);
    const payload = JSON.parse(text);
    const docs = Array.isArray(payload) ? payload : payload?.documents;

    if (!Array.isArray(docs) || docs.length === 0) {
      return [];
    }

    return docs.map((doc, index) => normalizeDocument(doc, index));
  } catch (error) {
    return [
      {
        id: 'fallback-error',
        title: 'ObjectBox Manifest Error',
        content: `Unable to parse objectbox-index.json. ${error?.message || 'Unknown parse error'}`,
        embedding: Array.from(deterministicVector('ObjectBox Manifest Error')),
        category: 'system',
      },
    ];
  }
}
