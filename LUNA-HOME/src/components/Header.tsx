import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchNotifications, type PortalNotification } from '../services/portalApi';

const lunaLogo = require('../../luna logo.png');

export default function Header() {
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');

  const openNotifications = async () => {
    setNotificationsVisible(true);
    setNotificationsLoading(true);
    setNotificationsError('');

    try {
      setNotifications(await fetchNotifications());
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setNotificationsLoading(false);
    }
  };

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
          onPress={() => void openNotifications()}
        >
          <Ionicons name="notifications-outline" size={18} color="#5e1232" />
        </TouchableOpacity>
      </View>

      <Modal
        visible={notificationsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotificationsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity
                accessibilityLabel="Close notifications"
                onPress={() => setNotificationsVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>
            {notificationsLoading ? (
              <ActivityIndicator color="#5e1232" style={styles.loading} />
            ) : notificationsError ? (
              <Text style={styles.emptyText}>{notificationsError}</Text>
            ) : notifications.length === 0 ? (
              <Text style={styles.emptyText}>You have no notifications.</Text>
            ) : (
              <ScrollView style={styles.notificationList}>
                {notifications.map((notification) => (
                  <View key={notification.id} style={styles.notificationRow}>
                    <View style={[styles.statusDot, notification.is_read && styles.readDot]} />
                    <View style={styles.notificationCopy}>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                      <Text style={styles.notificationDate}>
                        {new Date(notification.created_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  modalCard: {
    maxHeight: '75%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    paddingVertical: 24,
  },
  emptyText: {
    color: '#475569',
    fontSize: 15,
    paddingVertical: 18,
  },
  notificationList: {
    flexGrow: 0,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5e1232',
    marginTop: 6,
    marginRight: 12,
  },
  readDot: {
    backgroundColor: '#cbd5e1',
  },
  notificationCopy: {
    flex: 1,
  },
  notificationMessage: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  notificationDate: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 5,
  },
});
