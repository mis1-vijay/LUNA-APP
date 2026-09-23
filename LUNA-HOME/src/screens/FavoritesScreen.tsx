import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { fetchFavoritesData } from '../services/portalApi';

type FavoriteItem = {
  title: string;
  category: string;
  accent: string;
};

export default function FavoritesScreen() {
  const { favorites, toggleFavorite } = useAppContext();
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const items = await fetchFavoritesData();
        setFavoriteItems(items);
      } catch (error) {
        console.warn('Failed to load favorites', error);
        setFavoriteItems([]);
      } finally {
        setLoading(false);
      }
    };

    void loadFavorites();
  }, []);

  const visibleFavorites = useMemo(
    () => favoriteItems.filter((item) => favorites.includes(`${item.category}:${item.title}`)),
    [favoriteItems, favorites],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <View style={styles.container}>
        <Text style={styles.title}>Favorites</Text>
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator size="small" color="#5e1232" />
            <Text style={styles.placeholderText}>Loading favorites…</Text>
          </View>
        ) : visibleFavorites.length > 0 ? (
          visibleFavorites.map((item, index) => (
            <View key={`${item.title}-${item.category}-${index}`} style={styles.favoriteItem}>
              <View style={[styles.dot, { backgroundColor: item.accent }]} />
              <View style={styles.textWrap}>
                <Text style={styles.favoriteTitle}>{item.title}</Text>
                <Text style={styles.favoriteMeta}>{item.category}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.favoriteButton}
                onPress={() => toggleFavorite(`${item.category}:${item.title}`)}
              >
                <Text style={styles.favoriteButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No favorites saved yet. Tap the star on any item to track it here.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  title: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 14,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  favoriteTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  favoriteMeta: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  favoriteButton: {
    backgroundColor: '#5e1232',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginLeft: 10,
  },
  favoriteButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  placeholder: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
  },
  placeholderText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
});
