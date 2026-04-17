import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

export function SearchBar({ value, onChangeText, onSubmit, isLoading }) {
  const quickSearches = [
    { label: '🏕️ Shelter', query: 'How to build shelter' },
    { label: '💧 Water', query: 'How to find clean water' },
    { label: '🔥 Fire', query: 'How to start a fire' },
    { label: '🩹 First Aid', query: 'First aid for injuries' },
  ];

  const handleQuickSearch = (query) => {
    onChangeText(query);
    setTimeout(() => {
      onSubmit();
    }, 0);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask a survival question..."
          placeholderTextColor={colors.textMuted}
          editable={!isLoading}
          onSubmitEditing={onSubmit}
        />
        <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={onSubmit} disabled={isLoading}>
          <Text style={styles.buttonText}>{isLoading ? '⏳' : '🔍'}</Text>
        </Pressable>
      </View>

      <View style={styles.quickSearchContainer}>
        {quickSearches.map((search, index) => (
          <Pressable
            key={index}
            style={[styles.quickButton, isLoading && styles.quickButtonDisabled]}
            onPress={() => handleQuickSearch(search.query)}
            disabled={isLoading}
          >
            <Text style={styles.quickButtonText}>{search.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSecondary,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  quickSearchContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickButtonDisabled: {
    opacity: 0.5,
  },
  quickButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
});
