import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SearchBar } from '../components/SearchBar';
import { ResultCard } from '../components/ResultCard';
import { useAppStore } from '../store/useAppStore';
import { generateEmbedding } from '../ml/embedding';
import { searchNearestNeighbors } from '../db/vectorRepository';

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchModeLabel, setSearchModeLabel] = useState('Search mode: waiting for query');

  const results = useAppStore((state) => state.results);
  const setResults = useAppStore((state) => state.setResults);
  const modelPath = useAppStore((state) => state.assetPaths.model);
  const modelVocabPath = useAppStore((state) => state.assetPaths.modelVocab);

  const onSearch = async () => {
    if (!query.trim()) {
      return;
    }

    setIsLoading(true);

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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Offline Search</Text>
      <SearchBar value={query} onChangeText={setQuery} onSubmit={onSearch} isLoading={isLoading} />
      <Text style={styles.modeLabel}>{searchModeLabel}</Text>

      <FlashList
        data={results}
        estimatedItemSize={120}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={({ item }) => <ResultCard item={item} />}
        ListEmptyComponent={<Text style={styles.empty}>No results yet. Run a search to test the local pipeline.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#0f172a',
  },
  header: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 14,
  },
  empty: {
    color: '#94a3b8',
    marginTop: 20,
  },
  modeLabel: {
    color: '#cbd5e1',
    marginBottom: 10,
    marginTop: 6,
    fontSize: 12,
  },
});
