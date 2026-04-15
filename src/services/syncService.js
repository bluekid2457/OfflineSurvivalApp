import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as Crypto from 'expo-crypto';
import { FALLBACK_ASSETS, REMOTE_ASSETS } from '../config/syncConfig';
import { LOCAL_PATHS } from '../config/paths';
import { initializeObjectBoxStore } from '../db/objectBoxStore';

async function ensureDirectories() {
  await FileSystem.makeDirectoryAsync(LOCAL_PATHS.objectBoxDir, { intermediates: true });
  await FileSystem.makeDirectoryAsync(LOCAL_PATHS.modelDir, { intermediates: true });
}

function hasRemoteAssetConfig(item) {
  return Boolean(item?.url && !item.url.includes('example.com') && item?.sha256 && !item.sha256.startsWith('REPLACE_WITH'));
}

async function hashFileSha256(uri) {
  try {
    // eslint-disable-next-line import/namespace
    const base64Encoding = FileSystem['EncodingType']?.Base64 || 'base64';
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: base64Encoding,
    });

    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
  } catch {
    return null;
  }
}

async function verifyChecksumIfProvided(uri, expectedHash) {
  if (!expectedHash || expectedHash.startsWith('REPLACE_WITH')) {
    return true;
  }

  const hash = await hashFileSha256(uri);
  if (!hash) {
    return false;
  }

  return hash.toLowerCase() === expectedHash.toLowerCase();
}

async function removeExistingFileIfNeeded(uri) {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

async function copyBundledAsset(assetModuleId, destinationUri) {
  await removeExistingFileIfNeeded(destinationUri);

  try {
    const asset = Asset.fromModule(assetModuleId);
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Bundled asset URI was not available after download.');
    }

    await FileSystem.copyAsync({
      from: asset.localUri,
      to: destinationUri,
    });
    return;
  } catch (error) {
    if (assetModuleId && typeof assetModuleId === 'object') {
      await FileSystem.writeAsStringAsync(destinationUri, JSON.stringify(assetModuleId));
      return;
    }

    throw error;
  }
}

async function downloadAsset(remoteConfig, destinationUri, fallbackModuleId) {
  if (hasRemoteAssetConfig(remoteConfig)) {
    await removeExistingFileIfNeeded(destinationUri);
    const result = await FileSystem.downloadAsync(remoteConfig.url, destinationUri);
    const valid = await verifyChecksumIfProvided(result.uri, remoteConfig.sha256);

    if (!valid) {
      throw new Error(`Checksum verification failed for ${destinationUri}`);
    }

    return { source: 'remote', uri: result.uri };
  }

  await copyBundledAsset(fallbackModuleId, destinationUri);
  return { source: 'fallback', uri: destinationUri };
}

function isLikelyValidModelFile(info) {
  // Real MiniLM ONNX files are tens of MB. Placeholder text files are tiny.
  return Boolean(info?.exists && Number(info?.size || 0) > 1024 * 1024);
}

function isLikelyValidVocabFile(info) {
  // Real vocab.txt is typically hundreds of KB for BERT-family tokenizers.
  return Boolean(info?.exists && Number(info?.size || 0) > 10 * 1024);
}

export async function syncCoreAssets(onProgress) {
  await ensureDirectories();

  const update = (status, progress) => {
    if (typeof onProgress === 'function') {
      onProgress({ status, progress });
    }
  };

  update('Preparing local directories...', 0.1);

  const objectBoxDataResult = await downloadAsset(
    REMOTE_ASSETS.objectBoxData,
    LOCAL_PATHS.objectBoxDataFileUri,
    FALLBACK_ASSETS.objectBoxDataModule,
  );

  update('ObjectBox data ready. Fetching lock file...', 0.35);

  const objectBoxLockResult = await downloadAsset(
    REMOTE_ASSETS.objectBoxLock,
    LOCAL_PATHS.objectBoxLockFileUri,
    FALLBACK_ASSETS.objectBoxLockModule,
  );

  update('ObjectBox lock ready. Fetching index manifest...', 0.5);

  const objectBoxIndexResult = await downloadAsset(
    REMOTE_ASSETS.objectBoxIndex,
    LOCAL_PATHS.objectBoxIndexFileUri,
    FALLBACK_ASSETS.objectBoxIndexModule,
  );

  update('ObjectBox files ready. Fetching model...', 0.7);

  const modelResult = await downloadAsset(
    REMOTE_ASSETS.model,
    LOCAL_PATHS.modelFileUri,
    FALLBACK_ASSETS.modelModule,
  );

  update('Model ready. Fetching tokenizer vocab...', 0.82);

  const modelVocabResult = await downloadAsset(
    REMOTE_ASSETS.modelVocab,
    LOCAL_PATHS.modelVocabFileUri,
    FALLBACK_ASSETS.modelVocabModule,
  );

  await initializeObjectBoxStore({
    directoryPath: LOCAL_PATHS.objectBoxDir,
    indexFileUri: LOCAL_PATHS.objectBoxIndexFileUri,
  });

  update('Offline assets ready.', 1);

  return {
    objectBoxData: objectBoxDataResult,
    objectBoxLock: objectBoxLockResult,
    objectBoxIndex: objectBoxIndexResult,
    model: modelResult,
    modelVocab: modelVocabResult,
    objectBoxReady: true,
    paths: {
      objectBoxDir: LOCAL_PATHS.objectBoxDir,
      objectBoxData: LOCAL_PATHS.objectBoxDataFileUri,
      objectBoxLock: LOCAL_PATHS.objectBoxLockFileUri,
      objectBoxIndex: LOCAL_PATHS.objectBoxIndexFileUri,
      model: LOCAL_PATHS.modelFileUri,
      modelVocab: LOCAL_PATHS.modelVocabFileUri,
    },
  };
}

export async function checkLocalAssetsExist() {
  const [objectBoxDataInfo, objectBoxLockInfo, objectBoxIndexInfo, modelInfo, modelVocabInfo] = await Promise.all([
    FileSystem.getInfoAsync(LOCAL_PATHS.objectBoxDataFileUri),
    FileSystem.getInfoAsync(LOCAL_PATHS.objectBoxLockFileUri),
    FileSystem.getInfoAsync(LOCAL_PATHS.objectBoxIndexFileUri),
    FileSystem.getInfoAsync(LOCAL_PATHS.modelFileUri),
    FileSystem.getInfoAsync(LOCAL_PATHS.modelVocabFileUri),
  ]);

  const filesReady = Boolean(
    objectBoxDataInfo.exists &&
      objectBoxLockInfo.exists &&
      objectBoxIndexInfo.exists &&
      isLikelyValidModelFile(modelInfo) &&
      isLikelyValidVocabFile(modelVocabInfo),
  );

  let objectBoxReady = false;
  if (filesReady) {
    try {
      await initializeObjectBoxStore({
        directoryPath: LOCAL_PATHS.objectBoxDir,
        indexFileUri: LOCAL_PATHS.objectBoxIndexFileUri,
      });
      objectBoxReady = true;
    } catch {
      objectBoxReady = false;
    }
  }

  return {
    isReady: Boolean(filesReady && objectBoxReady),
    objectBoxReady,
    modelVocabExists: modelVocabInfo.exists,
    modelVocabSize: Number(modelVocabInfo?.size || 0),
    objectBoxDataExists: objectBoxDataInfo.exists,
    objectBoxLockExists: objectBoxLockInfo.exists,
    objectBoxIndexExists: objectBoxIndexInfo.exists,
    modelExists: modelInfo.exists,
    modelSize: Number(modelInfo?.size || 0),
  };
}
