import Constants from 'expo-constants';

const extraSync = Constants.expoConfig?.extra?.sync ?? {};

export const REMOTE_ASSETS = {
  objectBoxData: {
    url: extraSync.objectBoxDataUrl || 'https://example.com/objectbox/data.mdb',
    sha256: extraSync.objectBoxDataSha256 || 'REPLACE_WITH_OBJECTBOX_DATA_SHA256',
  },
  objectBoxLock: {
    url: extraSync.objectBoxLockUrl || 'https://example.com/objectbox/lock.mdb',
    sha256: extraSync.objectBoxLockSha256 || 'REPLACE_WITH_OBJECTBOX_LOCK_SHA256',
  },
  objectBoxIndex: {
    url: extraSync.objectBoxIndexUrl || 'https://example.com/objectbox/objectbox-index.json',
    sha256: extraSync.objectBoxIndexSha256 || 'REPLACE_WITH_OBJECTBOX_INDEX_SHA256',
  },
  model: {
    url: extraSync.modelUrl || 'https://example.com/model.onnx',
    sha256: extraSync.modelSha256 || 'REPLACE_WITH_MODEL_SHA256',
  },
  modelVocab: {
    url: extraSync.modelVocabUrl || 'https://example.com/vocab.txt',
    sha256: extraSync.modelVocabSha256 || 'REPLACE_WITH_MODEL_VOCAB_SHA256',
  },
};

export const FALLBACK_ASSETS = {
  objectBoxDataModule: require('../../assets/objectbox/data.mdb'),
  objectBoxLockModule: require('../../assets/objectbox/lock.mdb'),
  objectBoxIndexModule: require('../../assets/objectbox/objectbox-index.json'),
  modelModule: require('../../assets/models/all-MiniLM-L6-v2.onnx'),
  modelVocabModule: require('../../assets/models/vocab.txt'),
};
