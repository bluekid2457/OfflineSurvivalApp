import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function SearchBar({ value, onChangeText, onSubmit, isLoading }) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="Ask an offline survival question"
        placeholderTextColor="#64748b"
        editable={!isLoading}
        onSubmitEditing={onSubmit}
      />
      <Pressable style={[styles.button, isLoading && styles.buttonDisabled]} onPress={onSubmit} disabled={isLoading}>
        <Text style={styles.buttonText}>{isLoading ? 'Searching...' : 'Search'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e2e8f0',
    backgroundColor: '#0b1220',
  },
  button: {
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#082f49',
    fontWeight: '700',
  },
});
