import { LOCAL_PATHS } from '../config/paths';
import { getObjectBoxStore, initializeObjectBoxStore } from './objectBoxStore';

export function getDatabase() {
  return getObjectBoxStore();
}

export async function initializeDatabase() {
  return initializeObjectBoxStore({
    directoryPath: LOCAL_PATHS.objectBoxDir,
    indexFileUri: LOCAL_PATHS.objectBoxIndexFileUri,
  });
}
