import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SyncScreen } from './src/screens/SyncScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { useAppStore } from './src/store/useAppStore';

export default function App() {
  const isReady = useAppStore((state) => state.isReady);
  const isOfflineMode = useAppStore((state) => state.isOfflineMode);
  const hydrateFromDisk = useAppStore((state) => state.hydrateFromDisk);
  const checkConnectivity = useAppStore((state) => state.checkConnectivity);

  useEffect(() => {
    hydrateFromDisk();
  }, [hydrateFromDisk]);

  useEffect(() => {
    checkConnectivity();
    const interval = setInterval(() => {
      checkConnectivity();
    }, 10000);

    return () => clearInterval(interval);
  }, [checkConnectivity]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      {isOfflineMode ? <SyncBanner /> : null}
      {isReady ? <SearchScreen /> : <SyncScreen />}
    </SafeAreaView>
  );
}

function SyncBanner() {
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineText}>Offline mode</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  offlineBanner: {
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#f59e0b',
  },
  offlineText: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 12,
  },
});
