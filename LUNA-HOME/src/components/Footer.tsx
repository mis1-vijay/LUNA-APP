import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const lunaLogo = require('../../luna logo.png');

export default function Footer() {
  return (
    <View style={styles.footer}>
      <View style={styles.brandRow}>
        <Image source={lunaLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>Luna Technologies Pvt. Ltd.</Text>
      </View>
      <Text style={styles.subtitle}>© 2026 All rights reserved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: 22,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    marginTop: 18,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
  },
  brand: {
    color: '#0f172a',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
});
