import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    marginTop: 22,
  },
  title: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
});
