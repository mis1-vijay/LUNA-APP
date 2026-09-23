import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type LoadingStateProps = {
  text?: string;
};

export default function LoadingState({ text = 'Loading resources...' }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#0284c7" />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  text: {
    color: '#475569',
    fontSize: 13,
    marginLeft: 8,
  },
});
