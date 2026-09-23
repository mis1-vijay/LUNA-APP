import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ResourceCardProps = {
  title: string;
  subtitle: string;
  meta?: string;
  accentColor?: string;
  isFavorite?: boolean;
  onFavoritePress?: () => void;
  onPress?: () => void;
};

export default function ResourceCard({
  title,
  subtitle,
  meta,
  accentColor = '#38bdf8',
  isFavorite = false,
  onFavoritePress,
  onPress,
}: ResourceCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.card}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.metaWrap}>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        <TouchableOpacity onPress={onFavoritePress} activeOpacity={0.8} style={styles.favoriteButton}>
          <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={14} color={isFavorite ? '#fbbf24' : '#64748b'} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  accent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12,
  },
  metaWrap: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  meta: {
    color: '#5e1232',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  favoriteButton: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
