import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { fetchCurrentUserProfile, updateCurrentUserProfile } from '../services/portalApi';
import type { RootStackParamList } from '../types';

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { role, user, logout } = useAppContext();
  const [name, setName] = useState(user?.name ?? '');
  const [department, setDepartment] = useState(user?.department ?? 'Operations');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        setName(String(profile.name ?? user?.name ?? ''));
        setDepartment(String(profile.department ?? user?.department ?? 'Operations'));
        setEmail(String(profile.email ?? ''));
        setPhone(String(profile.phone ?? ''));
      } catch (error) {
        Alert.alert('Profile unavailable', error instanceof Error ? error.message : 'Unable to load your profile details.');
      }
    };

    void loadProfile();
  }, [user?.employeeId]);

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await updateCurrentUserProfile({
        name,
        department,
        email,
        phone,
      });
      Alert.alert('Profile updated', 'Your account details have been saved successfully.');
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'The profile could not be saved.');
    } finally {
      setIsSaving(false);
    }
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
            <Text style={styles.value}>{(user?.name ?? name) || 'Employee'}</Text>
            <Text style={styles.label}>Employee ID</Text>
            <Text style={styles.value}>{user?.employeeId ?? 'Unknown'}</Text>
            <Text style={styles.label}>Current Role</Text>
            <Text style={styles.roleBadge}>{role}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Account details</Text>

            <Text style={styles.inputLabel}>Full name</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Enter full name" editable={role !== 'Manager'} />

            <Text style={styles.inputLabel}>Department</Text>
            <TextInput value={department} onChangeText={setDepartment} style={styles.input} placeholder="Operations" editable={role !== 'Manager'} />

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" editable={role !== 'Manager'} />

            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholder="+91 98xxxxxx" keyboardType="phone-pad" editable={role !== 'Manager'} />

            {role !== 'Manager' ? (
              <TouchableOpacity style={styles.saveButton} onPress={() => void handleSaveProfile()} disabled={isSaving} activeOpacity={0.9}>
                <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save profile'}</Text>
              </TouchableOpacity>
            ) : null}
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
  inputLabel: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 15,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#5e1232',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
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
