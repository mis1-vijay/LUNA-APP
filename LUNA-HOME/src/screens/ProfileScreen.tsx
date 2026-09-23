import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import type { RootStackParamList } from '../types';

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { role, user, logout } = useAppContext();

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Profile</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Employee</Text>
            <Text style={styles.value}>{user?.name ?? 'Vijay Jadhav'}</Text>
            <Text style={styles.label}>Employee ID</Text>
            <Text style={styles.value}>{user?.employeeId ?? '11233'}</Text>
            <Text style={styles.label}>Department</Text>
            <Text style={styles.value}>{user?.department ?? 'Operations'}</Text>
            <Text style={styles.label}>Current Role</Text>
            <Text style={styles.roleBadge}>{role}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account settings</Text>
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.8}
              onPress={() => Alert.alert('Password update', 'Password update flow is ready for the admin backend integration.')}
            >
              <Text style={styles.actionButtonText}>Update password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.8}
              onPress={() => Alert.alert('Employee details', 'Basic employee data is managed by the admin during user creation.')}
            >
              <Text style={styles.actionButtonText}>Employee details</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={() => void handleLogout()} activeOpacity={0.9}>
            <Text style={styles.logoutButtonText}>LOG OUT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingBottom: 28,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  title: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 16,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  value: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  roleBadge: {
    color: '#5e1232',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  actionButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  roleButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  roleButtonActive: {
    backgroundColor: '#e0ecff',
    borderColor: '#93c5fd',
  },
  roleButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  roleButtonTextActive: {
    color: '#0f172a',
  },
  logoutButton: {
    backgroundColor: '#5e1232',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
