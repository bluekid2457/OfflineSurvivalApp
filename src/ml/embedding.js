import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { NativeModules } from 'react-native';



let session = null;
let ort = null;
let vocabCache = null;
let vocabUriCache = null;

const EMBEDDING_DIMS = 384;
const MAX_TOKENS = 256;
const LOG_PREFIX = '[EmbeddingDiagnostics]';

function logInfo(message, extra) {
  if (extra !== undefined) {
    console.log(`${LOG_PREFIX} ${message}`, extra);
    return;
  }
  console.log(`${LOG_PREFIX} ${message}`);
}

function logWarn(message, extra) {
  if (extra !== undefined) {
    console.warn(`${LOG_PREFIX} ${message}`, extra);
    return;
  }
  console.warn(`${LOG_PREFIX} ${message}`);
}

function getRuntimeDiagnostics() {
  return {
    appOwnership: Constants.appOwnership,
    executionEnvironment: Constants.executionEnvironment,
    expoRuntimeVersion: Constants.expoRuntimeVersion,
    isHermes: Boolean(globalThis.HermesInternal),
    platform: Constants.platform,
  };
}

function isNativeOnnxEnabled() {
  return Boolean(Constants.expoConfig?.extra?.sync?.enableNativeOnnx);
}

function hasNativeOnnxModule() {
  return Boolean(NativeModules?.Onnxruntime?.install);
}

function tagEmbedding(values, source) {
  try {
    Object.defineProperty(values, 'source', {
      value: source,
      configurable: true,
      enumerable: false,
      writable: false,
    });
  } catch {
    // Ignore metadata tagging failures and return the embedding as-is.
  }

  return values;
}

async function loadOrt() {
  if (ort !== null) return ort;

  const nativeOnnxEnabled = isNativeOnnxEnabled();
  const nativeModuleAvailable = hasNativeOnnxModule();

  if (!nativeOnnxEnabled || !nativeModuleAvailable) {
    logWarn('ONNX runtime unavailable before import.', {
      nativeOnnxEnabled,
      nativeModuleAvailable,
      hasOnnxruntimeNativeModule: Boolean(NativeModules?.Onnxruntime),
      availableNativeModules: Object.keys(NativeModules || {}).filter((name) => name.toLowerCase().includes('onnx')),
      runtime: getRuntimeDiagnostics(),
    });
    ort = null;
    return null;
  }

  try {
    // onnxruntime-react-native requires a native (JSI) build — not compatible with Expo Go.
    // If the native module is absent, Module.install() throws; treat it as unavailable.
    const loaded = await import('onnxruntime-react-native');
    ort = loaded ?? null;
    logInfo('ONNX runtime import succeeded.', {
      hasInferenceSession: Boolean(ort?.InferenceSession?.create),
      hasTensor: Boolean(ort?.Tensor),
    });
  } catch (error) {
    logWarn('Failed to import onnxruntime-react-native.', {
      error: error?.message || error,
      runtime: getRuntimeDiagnostics(),
    });
    ort = null;
  }
  return ort;
}

function fallbackEmbedding(text, dims = EMBEDDING_DIMS) {
  const values = new Float32Array(dims);

  for (let i = 0; i < text.length; i += 1) {
    const index = i % dims;
    values[index] += ((text.charCodeAt(i) % 31) - 15) / 100;
  }

  return tagEmbedding(l2Normalize(values), 'fallback');
}

function l2Normalize(values) {
  let norm = 0;

  for (let i = 0; i < values.length; i += 1) {
    norm += values[i] * values[i];
  }

  if (norm <= 0) {
    return values;
  }

  const scale = 1 / Math.sqrt(norm);
  const normalized = new Float32Array(values.length);

  for (let i = 0; i < values.length; i += 1) {
    normalized[i] = values[i] * scale;
  }

  return normalized;
}

function stripAccents(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function basicTokenize(text) {
  return stripAccents(String(text || '').toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function wordpieceTokenize(token, vocab, unkToken) {
  if (vocab.has(token)) {
    return [token];
  }

  const pieces = [];
  let start = 0;

  while (start < token.length) {
    let end = token.length;
    let currentPiece = null;

    while (start < end) {
      const piece = token.slice(start, end);
      const candidate = start > 0 ? `##${piece}` : piece;

      if (vocab.has(candidate)) {
        currentPiece = candidate;
        break;
      }

      end -= 1;
    }

    if (!currentPiece) {
      return [unkToken];
    }

    pieces.push(currentPiece);
    start = end;
  }

  return pieces;
}

async function loadVocab(vocabUri) {
  if (!vocabUri) {
    logWarn('Tokenizer vocab URI is missing.');
    return null;
  }

  if (vocabCache && vocabUriCache === vocabUri) {
    return vocabCache;
  }

  try {
    const raw = await FileSystem.readAsStringAsync(vocabUri);
    const tokens = raw
      .split(/\r?\n/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    const vocab = new Map();
    for (let index = 0; index < tokens.length; index += 1) {
      vocab.set(tokens[index], index);
    }

    vocabCache = vocab;
    vocabUriCache = vocabUri;
    return vocab;
  } catch {
    logWarn('Failed to read tokenizer vocab file.', { vocabUri });
    return null;
  }
}

function toTensorData(values, type) {
  if (type === 'int64') {
    return BigInt64Array.from(values.map((value) => BigInt(value)));
  }

  if (type === 'float32') {
    return Float32Array.from(values);
  }

  return Int32Array.from(values);
}

function createTokenizedInput(text, vocab, maxTokens = MAX_TOKENS) {
  const padToken = '[PAD]';
  const unkToken = '[UNK]';
  const clsToken = '[CLS]';
  const sepToken = '[SEP]';

  const padId = vocab.get(padToken) ?? 0;
  const unkId = vocab.get(unkToken) ?? 100;
  const clsId = vocab.get(clsToken) ?? 101;
  const sepId = vocab.get(sepToken) ?? 102;

  const tokens = basicTokenize(text)
    .flatMap((token) => wordpieceTokenize(token, vocab, unkToken))
    .slice(0, Math.max(0, maxTokens - 2));

  const inputIds = [clsId, ...tokens.map((token) => vocab.get(token) ?? unkId), sepId];
  const attentionMask = new Array(inputIds.length).fill(1);

  while (inputIds.length < maxTokens) {
    inputIds.push(padId);
    attentionMask.push(0);
  }

  return { inputIds, attentionMask };
}

function pickEmbeddingTensor(outputs) {
  const outputValues = Object.values(outputs || {});

  for (let index = 0; index < outputValues.length; index += 1) {
    const tensor = outputValues[index];
    if (Array.isArray(tensor?.dims) && tensor.dims.length === 2 && tensor.dims[0] === 1) {
      return { tensor, pooled: true };
    }
  }

  for (let index = 0; index < outputValues.length; index += 1) {
    const tensor = outputValues[index];
    if (Array.isArray(tensor?.dims) && tensor.dims.length === 3 && tensor.dims[0] === 1) {
      return { tensor, pooled: false };
    }
  }

  return null;
}

function meanPool(hiddenState, attentionMask, sequenceLength, hiddenSize) {
  const pooled = new Float32Array(hiddenSize);
  let validTokens = 0;

  for (let tokenIndex = 0; tokenIndex < sequenceLength; tokenIndex += 1) {
    if (!attentionMask[tokenIndex]) {
      continue;
    }

    validTokens += 1;

    for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
      const flatIndex = tokenIndex * hiddenSize + hiddenIndex;
      pooled[hiddenIndex] += Number(hiddenState[flatIndex] || 0);
    }
  }

  if (validTokens === 0) {
    return pooled;
  }

  for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
    pooled[hiddenIndex] /= validTokens;
  }

  return pooled;
}

async function runEmbeddingInference(text, modelUri, vocabUri) {
  const loaded = await initializeEmbeddingSession(modelUri);
  const loadedOrt = await loadOrt();
  const vocab = await loadVocab(vocabUri);

  if (!loaded || !loadedOrt?.Tensor || !vocab) {
    logWarn('Inference prerequisites not met.', {
      hasSession: Boolean(loaded),
      hasTensorCtor: Boolean(loadedOrt?.Tensor),
      hasVocab: Boolean(vocab),
      modelUri,
      vocabUri,
      runtime: getRuntimeDiagnostics(),
    });
    return null;
  }

  const { inputIds, attentionMask } = createTokenizedInput(text, vocab, MAX_TOKENS);

  const inputMetadata = loaded.inputMetadata || {};
  const inputNames = loaded.inputNames || [];
  const feeds = {};

  const idsName = inputNames.find((name) => name.includes('input_ids')) || inputNames[0];
  const maskName = inputNames.find((name) => name.includes('attention_mask'));
  const typeIdsName = inputNames.find((name) => name.includes('token_type_ids'));

  if (!idsName) {
    logWarn('Model input names do not include input_ids.', { inputNames });
    return null;
  }

  const idsType = inputMetadata?.[idsName]?.type || 'int64';
  feeds[idsName] = new loadedOrt.Tensor(idsType, toTensorData(inputIds, idsType), [1, inputIds.length]);

  if (maskName) {
    const maskType = inputMetadata?.[maskName]?.type || idsType;
    feeds[maskName] = new loadedOrt.Tensor(maskType, toTensorData(attentionMask, maskType), [1, attentionMask.length]);
  }

  if (typeIdsName) {
    const typeIds = new Array(inputIds.length).fill(0);
    const typeIdsType = inputMetadata?.[typeIdsName]?.type || idsType;
    feeds[typeIdsName] = new loadedOrt.Tensor(typeIdsType, toTensorData(typeIds, typeIdsType), [1, typeIds.length]);
  }

  const outputs = await loaded.run(feeds);
  logInfo('Model inference run completed.', {
    outputNames: Object.keys(outputs || {}),
  });
  const picked = pickEmbeddingTensor(outputs);

  if (!picked?.tensor?.data || !Array.isArray(picked.tensor.dims)) {
    logWarn('Could not find an embedding tensor in model outputs.');
    return null;
  }

  if (picked.pooled) {
    return l2Normalize(Float32Array.from(picked.tensor.data));
  }

  const dims = picked.tensor.dims;
  const sequenceLength = Number(dims[1] || inputIds.length);
  const hiddenSize = Number(dims[2] || EMBEDDING_DIMS);
  const pooled = meanPool(picked.tensor.data, attentionMask, sequenceLength, hiddenSize);
  return l2Normalize(pooled);
}

export async function initializeEmbeddingSession(modelUri) {
  if (session) {
    return session;
  }

  if (!modelUri) {
    logWarn('Model URI is missing, session init skipped.');
    return null;
  }

  const loaded = await loadOrt();

  if (!loaded?.InferenceSession?.create) {
    logWarn('ONNX runtime missing InferenceSession.create.', {
      hasOrt: Boolean(loaded),
      keys: Object.keys(loaded || {}),
      runtime: getRuntimeDiagnostics(),
    });
    return null;
  }

  try {
    session = await loaded.InferenceSession.create(modelUri);
    logInfo('ONNX inference session created.', { modelUri });
    return session;
  } catch (error) {
    logWarn('Failed to create ONNX inference session.', {
      modelUri,
      error: error?.message || error,
    });
    return null;
  }
}

export async function generateEmbedding(text, modelUri, vocabUri) {
  if (!text?.trim()) {
    return tagEmbedding(new Float32Array(EMBEDDING_DIMS), 'empty');
  }

  try {
    const inferredEmbedding = await runEmbeddingInference(text, modelUri, vocabUri);
    if (inferredEmbedding) {
      logInfo('Returning ONNX embedding.', { dims: inferredEmbedding.length });
      return tagEmbedding(inferredEmbedding, 'onnx');
    }
  } catch (error) {
    // If real inference fails for any reason, return a deterministic fallback so search remains functional.
    logWarn('Unhandled inference exception; using fallback embedding.', error?.message || error);
  }

  logWarn('Returning fallback embedding.', { queryLength: text.length });
  return fallbackEmbedding(text);
}
