import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../context/AppContext';
import { fetchNotifications, type PortalNotification } from '../services/portalApi';

const lunaLogo = require('../../luna logo.png');

export default function Header({ includeTopInset = false }: { includeTopInset?: boolean }) {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAppContext();
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const readStorageKey = user ? `luna-read-notifications-${user.employeeId}` : '';

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated || !user || !readStorageKey) {
      return [];
    }
    try {
      const [nextNotifications, storedReadIds] = await Promise.all([
        fetchNotifications(),
        AsyncStorage.getItem(readStorageKey),
      ]);
      const parsedReadIds: unknown = storedReadIds ? JSON.parse(storedReadIds) : [];
      const savedIds = Array.isArray(parsedReadIds)
        ? parsedReadIds.filter((id): id is string => typeof id === 'string')
        : [];
      setReadNotificationIds(savedIds);
      setNotifications(nextNotifications);
      setNotificationsError('');
      return nextNotifications;
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Unable to load notifications.');
      return null;
    }
  }, [isAuthenticated, readStorageKey, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setReadNotificationIds([]);
      return;
    }

    let active = true;
    const load = async () => {
      const nextNotifications = await refreshNotifications();
      if (!active || !nextNotifications) {
        return;
      }
    };
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAuthenticated, refreshNotifications, user]);

  const openNotifications = async () => {
    setNotificationsVisible(true);
    setNotificationsLoading(true);
    const latest = await refreshNotifications();
    if (latest && readStorageKey) {
      const nextReadIds = Array.from(new Set([
        ...readNotificationIds,
        ...latest.map((notification) => notification.id),
      ])).slice(-500);
      try {
        await AsyncStorage.setItem(readStorageKey, JSON.stringify(nextReadIds));
        setReadNotificationIds(nextReadIds);
      } catch (error) {
        console.warn('Failed to save read notification state', error);
        setNotificationsError('Notifications loaded, but read status could not be saved on this device.');
      }
    }
    setNotificationsLoading(false);
  };

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read && !readNotificationIds.includes(notification.id),
  ).length;

  return (
    <View style={[styles.header, { paddingTop: includeTopInset ? insets.top : 8 }]}>
      <View style={styles.brandBlock}>
        <Image source={lunaLogo} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandText}>LUNA TECHNOLOGIES</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.notificationButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="View notifications"
          onPress={() => void openNotifications()}
        >
          <Ionicons name="notifications-outline" size={18} color="#5e1232" />
          {unreadCount > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
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
                    <View
                      style={[
                        styles.statusDot,
                        (notification.is_read || readNotificationIds.includes(notification.id)) && styles.readDot,
                      ]}
                    />
                    <View style={styles.notificationCopy}>
                      <Text style={styles.notificationTitle}>{notification.title ?? 'Resource update'}</Text>
                      <Text style={styles.notificationMessage}>{notification.message}</Text>
                      <Text style={styles.notificationDetails}>
                        {notification.department ?? 'All departments'}
                        {notification.action ? ` · ${notification.action}` : ''}
                      </Text>
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
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
    lineHeight: 24,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationButton: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f8fafc',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
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
  notificationTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  notificationDetails: {
    color: '#475569',
    fontSize: 12,
    marginTop: 5,
    textTransform: 'capitalize',
  },
  notificationDate: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 5,
  },
});
