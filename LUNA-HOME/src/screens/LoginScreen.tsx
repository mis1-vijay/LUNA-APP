import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAppContext } from '../context/AppContext';
import type { UserRole } from '../services/authService';

const lunaLogo = require('../../luna logo.png');

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

const dashboardRouteByRole: Record<UserRole, 'MainTabs'> = {
  Admin: 'MainTabs',
  Manager: 'MainTabs',
  Supervisor: 'MainTabs',
  User: 'MainTabs',
};

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, role } = useAppContext();

  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace(dashboardRouteByRole[role] ?? 'MainTabs');
    }
  }, [isAuthenticated, navigation, role]);

  const handleLogin = async () => {
    if (!employeeId.trim() || !password.trim()) {
      Alert.alert('Missing credentials', 'Enter both employee ID and password.');
      return;
    }

    setLoading(true);

    try {
      const result = await login(employeeId, password);

      if (result.success) {
        const nextRoute = dashboardRouteByRole[result.role ?? role ?? 'User'] ?? 'MainTabs';
        navigation.replace(nextRoute);
        return;
      }

      if (result.message?.toLowerCase().includes('unauthorized') || result.message?.toLowerCase().includes('invalid')) {
        Alert.alert('Unauthorized', result.message ?? 'Invalid employee ID or password.');
        return;
      }

      Alert.alert('Login failed', result.message ?? 'Please try again.');
    } catch (error) {
      Alert.alert('Network error', 'Unable to reach the Luna API. Please check your backend URL and try again.');
      console.warn('Login error', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image source={lunaLogo} style={styles.logoPlaceholder} resizeMode="contain" />
            <Text style={styles.title}>LUNA TECHNOLOGIES</Text>
            <Text style={styles.subtitle}>PVT LTD • Internal Company Portal</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              value={employeeId}
              onChangeText={setEmployeeId}
              style={styles.input}
              placeholder="Employee ID"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <View style={styles.passwordWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.passwordInput}
                placeholder="Password"
                secureTextEntry={!showPassword}
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.eyeButton}
                onPress={() => setShowPassword((current) => !current)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#475569"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLogin} activeOpacity={0.9} disabled={loading}>
              {loading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.buttonText}>LOGIN</Text>}
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={() => Alert.alert('Reset Password', 'Password reset flow is coming soon.')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoPlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: '#eef2ff',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginTop: 6,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 32,
  },
  form: {
    paddingHorizontal: 35,
  },
  input: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    fontSize: 16,
    color: '#0f172a',
  },
  passwordWrap: {
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    paddingLeft: 15,
    paddingRight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    fontSize: 16,
    color: '#0f172a',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#5e1232',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  forgotText: {
    color: '#1d4ed8',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
});
