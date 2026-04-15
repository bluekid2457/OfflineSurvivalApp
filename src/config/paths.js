import * as FileSystem from 'expo-file-system/legacy';

// eslint-disable-next-line import/namespace
const documentDirectory = FileSystem['documentDirectory'] || FileSystem.Paths?.document?.uri || '';
const BASE_DIR = `${documentDirectory}offline-assets`;

export const LOCAL_PATHS = {
  baseDir: BASE_DIR,
  objectBoxDir: `${BASE_DIR}/objectbox`,
  modelDir: `${BASE_DIR}/models`,
  objectBoxDataFileUri: `${BASE_DIR}/objectbox/data.mdb`,
  objectBoxLockFileUri: `${BASE_DIR}/objectbox/lock.mdb`,
  objectBoxIndexFileUri: `${BASE_DIR}/objectbox/objectbox-index.json`,
  modelFileUri: `${BASE_DIR}/models/all-MiniLM-L6-v2.onnx`,
  modelVocabFileUri: `${BASE_DIR}/models/vocab.txt`,
};