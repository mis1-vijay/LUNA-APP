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
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useAppContext } from '../context/AppContext';
import { requestPasswordReset, resetPassword, type UserRole } from '../services/authService';

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
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmployeeId, setResetEmployeeId] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetRequestSent, setResetRequestSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
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

  const handleRequestResetCode = async () => {
    if (resetEmployeeId.trim().length < 3) {
      Alert.alert('Employee ID required', 'Enter your employee ID to request a reset code.');
      return;
    }

    setResetLoading(true);
    try {
      await requestPasswordReset(resetEmployeeId);
      setResetRequestSent(true);
      Alert.alert('Check your email', 'If the account exists and has an email on file, a reset code has been sent.');
    } catch (error) {
      Alert.alert('Reset request failed', error instanceof Error ? error.message : 'Unable to request a password reset.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetCode.trim().length !== 6 || resetPasswordValue.trim().length < 8) {
      Alert.alert('Invalid details', 'Enter the six-digit email code and a password with at least 8 characters.');
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(resetEmployeeId, resetCode, resetPasswordValue.trim());
      Alert.alert('Password updated', 'You can now sign in with your new password.');
      closeResetModal();
    } catch (error) {
      Alert.alert('Password reset failed', error instanceof Error ? error.message : 'Unable to reset your password.');
    } finally {
      setResetLoading(false);
    }
  };

  const closeResetModal = () => {
    setResetVisible(false);
    setResetCode('');
    setResetPasswordValue('');
    setResetRequestSent(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <Image source={lunaLogo} style={styles.logoPlaceholder} resizeMode="contain" />
            <Text
              style={styles.title}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              LUNA TECHNOLOGIES PVT. LTD.
            </Text>
            <Text style={styles.subtitle}>Internal Company Portal</Text>
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

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setResetEmployeeId(employeeId);
                setResetCode('');
                setResetPasswordValue('');
                setResetRequestSent(false);
                setResetVisible(true);
              }}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
      <Modal transparent visible={resetVisible} animationType="fade" onRequestClose={closeResetModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.resetModal}>
            <Text style={styles.resetTitle}>Reset password</Text>
            <Text style={styles.resetDescription}>Verify your email address to securely update your password.</Text>
            <TextInput
              value={resetEmployeeId}
              onChangeText={setResetEmployeeId}
              style={styles.input}
              placeholder="Employee ID"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {resetRequestSent ? (
              <>
                <TextInput
                  value={resetCode}
                  onChangeText={setResetCode}
                  style={styles.input}
                  placeholder="Six-digit email code"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <TextInput
                  value={resetPasswordValue}
                  onChangeText={setResetPasswordValue}
                  style={styles.input}
                  placeholder="New password (8+ characters)"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : null}
            {resetRequestSent ? (
              <TouchableOpacity
                style={styles.button}
                onPress={() => void handleResetPassword()}
                activeOpacity={0.9}
                disabled={resetLoading}
              >
                {resetLoading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.buttonText}>UPDATE PASSWORD</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.button}
                onPress={() => void handleRequestResetCode()}
                activeOpacity={0.9}
                disabled={resetLoading}
              >
                {resetLoading ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.buttonText}>SEND RESET CODE</Text>}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelResetButton}
              onPress={closeResetModal}
              activeOpacity={0.8}
              disabled={resetLoading}
            >
              <Text style={styles.cancelResetText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 72,
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
    marginTop: 0,
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
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.2,
    textAlign: 'center',
    includeFontPadding: false,
    marginHorizontal: 8,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 18,
    color: '#475569',
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  form: {
    paddingHorizontal: 35,
    marginTop: 10,
    paddingBottom: 12,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  resetModal: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
  },
  resetTitle: {
    color: '#0f172a',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 8,
  },
  resetDescription: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  cancelResetButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelResetText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '700',
  },
});
