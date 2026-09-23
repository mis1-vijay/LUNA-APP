import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type DepartmentCardProps = {
  name: string;
  tags: string[];
  accentColor?: string;
  isFavorite?: boolean;
  onFavoritePress?: () => void;
  onPress?: () => void;
};

export default function DepartmentCard({
  name,
  tags,
  accentColor = '#38bdf8',
  isFavorite = false,
  onFavoritePress,
  onPress,
}: DepartmentCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.card, { borderTopColor: accentColor }]}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
        <TouchableOpacity onPress={onFavoritePress} activeOpacity={0.8} style={styles.favoriteButton}>
          <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={14} color={isFavorite ? '#fbbf24' : '#64748b'} />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{name}</Text>
      <View style={styles.tagRow}>
        {tags.map((tag) => (
          <View key={`${name}-${tag}`} style={styles.tag}>
            <Text style={styles.tagText}>[{tag}]</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderTopWidth: 4,
    borderColor: '#e2e8f0',
    padding: 16,
    minHeight: 120,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  favoriteButton: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  tagText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '600',
  },
});
