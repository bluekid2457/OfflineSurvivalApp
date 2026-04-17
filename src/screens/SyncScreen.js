import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors } from '../theme/colors';

export function SyncScreen() {
  const isSyncing = useAppStore((state) => state.isSyncing);
  const syncProgress = useAppStore((state) => state.syncProgress);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const error = useAppStore((state) => state.error);
  const runInitialSync = useAppStore((state) => state.runInitialSync);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>🧭</Text>
        <Text style={styles.title}>Survival Guide</Text>
        <Text style={styles.subtitle}>Preparing offline knowledge base...</Text>
      </View>

      <View style={styles.progressSection}>
        <Text style={styles.progressLabel}>Downloading essential resources</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(syncProgress * 100, 2)}%` }]} />
        </View>
        <Text style={styles.progressPercent}>{Math.round(syncProgress * 100)}%</Text>
      </View>

      <Text style={styles.status}>{syncStatus}</Text>

      {error ? <Text style={styles.error}>⚠️ {error}</Text> : null}

      <Pressable style={[styles.button, isSyncing && styles.buttonDisabled]} onPress={runInitialSync} disabled={isSyncing}>
        <Text style={styles.buttonText}>
          {isSyncing ? '⏳ Preparing assets...' : '📥 Download & Setup'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  progressSection: {
    marginBottom: 32,
  },
  progressLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentBlue,
  },
  progressPercent: {
    color: colors.textTertiary,
    fontSize: 12,
    textAlign: 'right',
    fontWeight: '600',
  },
  status: {
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.accentRust,
    marginBottom: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  button: {
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#082f49',
    fontWeight: '800',
    fontSize: 16,
  },
});
