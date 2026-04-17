import React, { useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SearchBar } from '../components/SearchBar';
import { ResultCard } from '../components/ResultCard';
import { useAppStore } from '../store/useAppStore';
import { generateEmbedding } from '../ml/embedding';
import { searchNearestNeighbors } from '../db/vectorRepository';
import { colors } from '../theme/colors';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchModeLabel, setSearchModeLabel] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const results = useAppStore((state) => state.results);
  const setResults = useAppStore((state) => state.setResults);
  const modelPath = useAppStore((state) => state.assetPaths.model);
  const modelVocabPath = useAppStore((state) => state.assetPaths.modelVocab);

  const onSearch = async () => {
    if (!query.trim()) {
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const embedding = await generateEmbedding(query, modelPath, modelVocabPath);
      const response = await searchNearestNeighbors({ embedding, limit: 5, query });
      setResults(response.results || []);
      const sourceSuffix = embedding?.source ? ` [query=${embedding.source}]` : '';

      if (response.mode === 'vector') {
        setSearchModeLabel(`${response.reason || 'Using embeddings search'}${sourceSuffix}`);
      } else {
        setSearchModeLabel(`${response.reason || 'Using basic search (embeddings unavailable)'}${sourceSuffix}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🧭</Text>
      <Text style={styles.emptyTitle}>
        {hasSearched ? 'No results found' : 'Survival Field Manual'}
      </Text>
      <Text style={styles.emptyDescription}>
        {hasSearched
          ? 'Try a different search query'
          : 'Use the quick actions above or search for shelter, water, fire, first aid, and more'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Survival Guide</Text>
        <Text style={styles.subtitle}>Offline Knowledge Base</Text>
      </View>

      <SearchBar value={query} onChangeText={setQuery} onSubmit={onSearch} isLoading={isLoading} />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentBlue} />
          <Text style={styles.loadingText}>Searching knowledge base...</Text>
        </View>
      )}

      {!isLoading && hasSearched && searchModeLabel && (
        <Text style={styles.modeLabel}>📡 {searchModeLabel}</Text>
      )}

      {!isLoading && (
        <FlashList
          data={results}
          estimatedItemSize={140}
          keyExtractor={(item, index) => item.id || String(index)}
          renderItem={({ item }) => <ResultCard item={item} />}
          ListEmptyComponent={renderEmpty()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  modeLabel: {
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: 0,
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentBlue,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.textTertiary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
