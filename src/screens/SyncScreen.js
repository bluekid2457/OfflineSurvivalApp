import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../store/useAppStore';

export function SyncScreen() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const syncProgress = useAppStore((state) => state.syncProgress);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const error = useAppStore((state) => state.error);
  const runInitialSync = useAppStore((state) => state.runInitialSync);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LocalVectorDB</Text>
      <Text style={styles.subtitle}>Offline-first semantic search bootstrap</Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(syncProgress * 100, 2)}%` }]} />
      </View>

      <Text style={styles.status}>{syncStatus}</Text>
      {isOfflineMode ? <Text style={styles.offlineHint}>You are offline. Connect to internet to sync assets.</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={[styles.button, (isSyncing || isOfflineMode) && styles.buttonDisabled]} onPress={runInitialSync} disabled={isSyncing || isOfflineMode}>
        <Text style={styles.buttonText}>{isSyncing ? 'Syncing...' : 'Download & Prepare Offline Assets'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: 24,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22d3ee',
  },
  status: {
    color: '#cbd5e1',
    marginBottom: 10,
  },
  error: {
    color: '#fda4af',
    marginBottom: 18,
  },
  offlineHint: {
    color: '#fbbf24',
    marginBottom: 10,
  },
  button: {
    borderRadius: 14,
    backgroundColor: '#22d3ee',
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#083344',
    fontWeight: '800',
  },
});
