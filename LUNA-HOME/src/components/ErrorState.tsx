import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ErrorStateProps = {
  title?: string;
  message?: string;
};

export default function ErrorState({
  title = 'Connection issue',
  message = 'The system is temporarily unavailable.',
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="warning-outline" size={24} color="#dc2626" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
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
    color: '#7c2d12',
    fontSize: 12,
    textAlign: 'center',
  },
});
