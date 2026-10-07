import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppContext } from '../context/AppContext';
import { fetchAuditLogs, type AuditLog } from '../services/portalApi';
import type { RootStackParamList } from '../types';

type SystemAuditScreenProps = NativeStackScreenProps<RootStackParamList, 'SystemAudit'>;

function formatAction(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString();
}

export default function SystemAuditScreen({ navigation }: SystemAuditScreenProps) {
  const { role } = useAppContext();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      setLogs(await fetchAuditLogs());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load audit logs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'Admin') {
      void loadLogs();
    } else {
      setLoading(false);
    }
  }, [loadLogs, role]);

  const renderLog = ({ item }: { item: AuditLog }) => {
    const title = item.details?.title;
    const changedFields = item.details?.changed_fields;
    const summary =
      typeof title === 'string'
        ? title
        : Array.isArray(changedFields)
          ? `Changed: ${changedFields.join(', ')}`
          : item.target_id
            ? `${item.target_type} ${item.target_id}`
            : item.target_type;

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeading}>
          <Text style={styles.action}>{formatAction(item.action)}</Text>
          <Text style={styles.timestamp}>{formatTimestamp(item.created_at)}</Text>
        </View>
        <Text style={styles.summary}>{summary}</Text>
        <Text style={styles.actor}>
          {item.actor_name} · {item.actor_employee_id}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={22} color="#5e1232" />
        </TouchableOpacity>
        <View style={styles.heading}>
          <Text style={styles.title}>System Audit</Text>
          <Text style={styles.subtitle}>Recent administrative actions</Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Refresh audit logs"
          onPress={() => void loadLogs(true)}
          style={styles.refreshButton}
          disabled={loading || refreshing || role !== 'Admin'}
        >
          <Ionicons name="refresh" size={20} color="#5e1232" />
        </TouchableOpacity>
      </View>

      {role !== 'Admin' ? (
        <View style={styles.state}>
          <Text style={styles.errorText}>Admin access is required to view audit logs.</Text>
        </View>
      ) : loading ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color="#5e1232" />
          <Text style={styles.stateText}>Loading audit logs…</Text>
        </View>
      ) : error ? (
        <View style={styles.state}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadLogs()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderLog}
          contentContainerStyle={logs.length ? styles.list : styles.emptyList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void loadLogs(true)} tintColor="#5e1232" />
          }
          ListEmptyComponent={<Text style={styles.stateText}>No administrative actions have been recorded.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  heading: {
    flex: 1,
  },
  title: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
  },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 15,
  },
  logHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  action: {
    flex: 1,
    color: '#5e1232',
    fontWeight: '800',
    fontSize: 14,
  },
  timestamp: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'right',
  },
  summary: {
    color: '#0f172a',
    fontSize: 14,
    marginTop: 9,
  },
  actor: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 7,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  stateText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9,
    backgroundColor: '#5e1232',
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
