import { create } from 'zustand';
import { checkLocalAssetsExist, syncCoreAssets } from '../services/syncService';
import { LOCAL_PATHS } from '../config/paths';
import { fetchNetworkStatus } from '../services/networkService';

export const useAppStore = create((set) => ({
  isReady: false,
  objectBoxReady: false,
  isSyncing: false,
  syncStatus: 'Waiting to sync',
  syncProgress: 0,
  isOfflineMode: false,
  error: null,
  assetPaths: {
    objectBoxDir: LOCAL_PATHS.objectBoxDir,
    objectBoxData: LOCAL_PATHS.objectBoxDataFileUri,
    objectBoxLock: LOCAL_PATHS.objectBoxLockFileUri,
    objectBoxIndex: LOCAL_PATHS.objectBoxIndexFileUri,
    model: LOCAL_PATHS.modelFileUri,
    modelVocab: LOCAL_PATHS.modelVocabFileUri,
  },  results: [],

  setResults: (results) => set({ results }),
  checkConnectivity: async () => {
    try {
      const status = await fetchNetworkStatus();
      set({
        isOfflineMode: !status.online,
      });
    } catch (_error) {
      set({
        isOfflineMode: true,
      });
    }
  },

  hydrateFromDisk: async () => {
    try {
      const status = await fetchNetworkStatus();
      set({
        isOfflineMode: !status.online,
      });
    } catch (_error) {
      set({
        isOfflineMode: true,
      });
    }

    const exists = await checkLocalAssetsExist();

    set({
      isReady: exists.isReady,
      objectBoxReady: exists.objectBoxReady,
      syncStatus: exists.isReady ? 'Offline assets found on device' : 'Assets missing, sync required',
    });
  },

  runInitialSync: async () => {
    set({
      isSyncing: true,
      error: null,
      syncProgress: 0,
      syncStatus: 'Starting sync...',
    });

    try {
      const payload = await syncCoreAssets(({ status, progress }) => {
        set({
          syncStatus: status,
          syncProgress: progress,
        });
      });

      set({
        isReady: true,
        objectBoxReady: payload.objectBoxReady,
        isSyncing: false,
        syncStatus: 'Ready for Offline Mode',
        syncProgress: 1,
        assetPaths: payload.paths,
      });
    } catch (error) {
      set({
        isSyncing: false,
        error: error?.message || 'Sync failed',
        syncStatus: 'Sync failed',
      });
    }
  },
}));
