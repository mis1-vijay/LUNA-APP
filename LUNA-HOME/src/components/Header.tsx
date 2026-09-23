import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const lunaLogo = require('../../luna logo.png');

export default function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.brandBlock}>
        <Image source={lunaLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandText}>{'LUNA TECHNOLOGIES\nPVT LTD'}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.notificationButton}
          activeOpacity={0.8}
          onPress={() => Alert.alert('Notifications', 'Notifications are coming soon.')}
        >
          <Ionicons name="notifications-outline" size={18} color="#5e1232" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
  },
  brandText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.6,
    lineHeight: 22,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
