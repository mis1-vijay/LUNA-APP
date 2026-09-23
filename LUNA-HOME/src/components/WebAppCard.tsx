import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type WebAppCardProps = {
  title: string;
  subtitle: string;
  accentColor?: string;
  isFavorite?: boolean;
  onFavoritePress?: () => void;
  onPress?: () => void;
};

export default function WebAppCard({
  title,
  subtitle,
  accentColor = '#0284c7',
  isFavorite = false,
  onFavoritePress,
  onPress,
}: WebAppCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.card, { borderColor: accentColor }]}
    >
      <View style={styles.topRow}>
        <View style={[styles.indicator, { backgroundColor: accentColor }]} />
        <TouchableOpacity onPress={onFavoritePress} activeOpacity={0.8} style={styles.favoriteButton}>
          <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={15} color={isFavorite ? '#fbbf24' : '#64748b'} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={[styles.action, { color: accentColor }]}>Open App -{'>'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#ffffff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
    marginRight: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  favoriteButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    marginBottom: 10,
  },
  title: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  action: {
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
});
