import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { fetchFavoritesData } from '../services/portalApi';
import type { RootStackParamList } from '../types';

type FavoriteItem = {
  title: string;
  category: string;
  accent: string;
  subtitle?: string;
  url?: string;
};

export default function FavoritesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { favorites, toggleFavorite, customModules, role } = useAppContext();
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

  const visibleFavorites = useMemo(() => {
    const catalog = new Map<string, FavoriteItem>();
    for (const item of favoriteItems) {
      catalog.set(`${item.category}:${item.title}`, item);
    }
    for (const module of customModules) {
      const roleRanks: Record<string, number> = { User: 1, Supervisor: 2, Manager: 3, Admin: 4 };
      const currentRank = roleRanks[role] ?? 0;
      const moduleIsVisible = role === 'Admin' || module.access.some((requiredRole) => currentRank >= (roleRanks[requiredRole] ?? Infinity));
      if (module.title.trim().toLowerCase() === 'user access matrix' || !moduleIsVisible) {
        continue;
      }

      const category = module.type === 'webApp' || module.type === 'webapp'
        ? 'Web App'
        : module.type === 'department'
          ? 'Department'
          : 'Report';
      const key = `${category}:${module.title}`;
      if (!catalog.has(key)) {
        catalog.set(key, {
          title: module.title,
          category,
          accent: module.accent,
          subtitle: module.subtitle,
          url: module.link,
        });
      }
    }

    return favorites
      .map((key) => catalog.get(key))
      .filter((item): item is FavoriteItem => item !== undefined);
  }, [customModules, favoriteItems, favorites, role]);

  const openFavorite = (item: FavoriteItem) => {
    if (item.category === 'Department') {
      navigation.navigate('DepartmentWorkspace', { department: item.title });
      return;
    }

    if (item.url) {
      navigation.navigate('WebAppDetail', {
        appName: item.title,
        appSubtitle: item.subtitle ?? (item.category === 'Web App' ? 'Portal access' : 'Portal resource'),
        accent: item.accent,
        url: item.url,
      });
      return;
    }

    Alert.alert('Unable to open resource', 'This resource does not have a destination URL yet.');
  };

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
              <TouchableOpacity style={styles.favoriteContent} activeOpacity={0.8} onPress={() => openFavorite(item)}>
                <View style={[styles.dot, { backgroundColor: item.accent }]} />
                <View style={styles.textWrap}>
                  <Text style={styles.favoriteTitle}>{item.title}</Text>
                  <Text style={styles.favoriteMeta}>{item.category}</Text>
                </View>
              </TouchableOpacity>
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
  favoriteContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
