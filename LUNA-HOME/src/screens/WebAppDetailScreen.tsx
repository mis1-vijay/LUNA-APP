import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { resolveAppUrl } from '../data/portalData';
import { RootStackParamList } from '../types';

type WebAppDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'WebAppDetail'>;

export default function WebAppDetailScreen({ route, navigation }: WebAppDetailScreenProps) {
  const { appName, accent, url } = route.params;
  const finalUrl = resolveAppUrl(appName, url);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{appName}</Text>
      </View>
      <WebView
        source={{ uri: finalUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        sharedCookiesEnabled
        originWhitelist={['*']}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    paddingVertical: 6,
  },
  backText: {
    color: '#0284c7',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
