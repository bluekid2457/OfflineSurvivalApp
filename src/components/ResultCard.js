import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function ResultCard({ item }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.content}>{item.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  title: {
    color: '#e2e8f0',
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 16,
  },
  content: {
    color: '#cbd5e1',
    lineHeight: 20,
  },
});
