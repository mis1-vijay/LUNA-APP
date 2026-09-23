import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type EmptyStateProps = {
  title?: string;
  message?: string;
};

export default function EmptyState({
  title = 'No results',
  message = 'There are no items available right now.',
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="folder-open-outline" size={24} color="#64748b" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 22,
  },
  title: {
    color: '#0f172a',
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  message: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
});
