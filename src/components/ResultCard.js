import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { categorizeContent } from '../utils/categorizer';

export function ResultCard({ item }) {
  const category = useMemo(() => categorizeContent(item.title + ' ' + item.content), [item]);

  return (
    <View style={styles.card}>
      {category && (
        <View style={[styles.categoryBadge, { backgroundColor: category.color + '20', borderColor: category.color }]}>
          <Text style={[styles.categoryLabel, { color: category.color }]}>
            {category.label}
          </Text>
        </View>
      )}
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.content} numberOfLines={3}>
        {item.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfacePrimary,
    borderWidth: 1,
    borderColor: colors.borderDark,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  title: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 16,
  },
  content: {
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 14,
  },
});
