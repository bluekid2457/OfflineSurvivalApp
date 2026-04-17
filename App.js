import React, { useEffect } from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import { SyncScreen } from './src/screens/SyncScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { useAppStore } from './src/store/useAppStore';
import { colors } from './src/theme/colors';

export default function App() {
  const isReady = useAppStore((state) => state.isReady);
  const hydrateFromDisk = useAppStore((state) => state.hydrateFromDisk);

  useEffect(() => {
    hydrateFromDisk();
  }, [hydrateFromDisk]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {isReady ? <SearchScreen /> : <SyncScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
