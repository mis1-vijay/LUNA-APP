import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import { useAppContext } from '../context/AppContext';
import { fetchSearchData } from '../services/portalApi';
import type { RootStackParamList } from '../types';

type SearchItem = {
  title: string;
  category: 'Web App' | 'Department' | 'Report' | 'Admin';
  accent: string;
  role: string[];
  url?: string;
  subtitle?: string;
};

const ROLE_RANK: Record<string, number> = { user: 1, employee: 1, supervisor: 2, manager: 3, admin: 4 };

export default function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { role, customModules, isFavorite, toggleFavorite } = useAppContext();

  useEffect(() => {
    const loadSearchItems = async () => {
      try {
        const items = await fetchSearchData();
        const merged: SearchItem[] = [
          ...items,
          ...customModules.filter((item) => item.title.trim().toLowerCase() !== 'user access matrix').map((item): SearchItem => ({
            title: item.title,
            category: item.type === 'webApp' ? 'Web App' : item.type === 'department' ? 'Department' : 'Report',
            accent: item.accent,
            role: item.access.map((access) => access.toLowerCase()),
            url: item.link,
            subtitle: item.subtitle,
          })),
        ];
        setSearchItems(merged);
      } catch (error) {
        console.warn('Failed to load search items', error);
        setSearchItems([]);
      } finally {
        setLoading(false);
      }
    };

    void loadSearchItems();
  }, [customModules]);

  const filteredResources = useMemo(() => {
    return searchItems.filter((item) => {
      const itemRoles = Array.isArray(item.role) && item.role.length > 0 ? item.role : ['user'];
      const matchesRole = role === 'Admin' || itemRoles.some(
        (requiredRole) => (ROLE_RANK[role.toLowerCase()] ?? 0) >= (ROLE_RANK[requiredRole.toLowerCase()] ?? Infinity),
      );
      const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase());
      return matchesRole && matchesQuery;
    });
  }, [query, role, searchItems]);

  const openSearchItem = async (item: SearchItem) => {
    if (item.category === 'Department') {
      navigation.navigate('DepartmentWorkspace', { department: item.title });
      return;
    }

    if (item.category === 'Web App' && !item.url) {
      Alert.alert('Unable to open app', 'This app does not have a destination URL yet.');
      return;
    }

    if (item.url && item.category === 'Web App') {
      navigation.navigate('WebAppDetail', {
        appName: item.title,
        appSubtitle: item.subtitle ?? 'Portal access',
        accent: item.accent,
        url: item.url,
      });
      return;
    }

    if (item.url) {
      navigation.navigate('WebAppDetail', {
        appName: item.title,
        appSubtitle: item.subtitle ?? 'Portal resource',
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
        <Text style={styles.title}>Search</Text>
        <SearchBar placeholder="Search company resources" value={query} onChangeText={setQuery} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <View style={styles.placeholder}>
              <ActivityIndicator size="small" color="#5e1232" />
              <Text style={styles.placeholderText}>Loading resources…</Text>
            </View>
          ) : filteredResources.length > 0 ? (
            filteredResources.map((item, index) => (
              <TouchableOpacity
                key={`${item.title}-${item.category}-${index}`}
                style={styles.resultItem}
                activeOpacity={0.8}
                onPress={() => void openSearchItem(item)}
              >
                <View style={styles.resultBody}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <Text style={styles.resultMeta}>{item.category}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.favoriteButton}
                  onPress={() => toggleFavorite(`${item.category}:${item.title}`)}
                >
                  <Ionicons
                    name={isFavorite(`${item.category}:${item.title}`) ? 'star' : 'star-outline'}
                    size={16}
                    color={isFavorite(`${item.category}:${item.title}`) ? '#fbbf24' : '#64748b'}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No matching resources found for {role.toLowerCase()} access.</Text>
            </View>
          )}
        </ScrollView>
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
  scrollContent: {
    paddingBottom: 30,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  resultBody: {
    flex: 1,
    paddingRight: 12,
  },
  resultTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultMeta: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  favoriteButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  placeholderText: {
    color: '#475569',
    fontSize: 14,
  },
});
