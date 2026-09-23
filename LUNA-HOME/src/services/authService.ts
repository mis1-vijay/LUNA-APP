import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AUTH_LOGIN_URL } from '../config/api';

export type UserRole = 'Admin' | 'Manager' | 'Supervisor' | 'User';

export type SessionUser = {
  name: string;
  employeeId: string;
  role: UserRole;
  department: string;
};

export type AuthResult = {
  success: boolean;
  message?: string;
  user?: SessionUser;
  token?: string;
  role?: UserRole;
};

const STORAGE_KEY = 'luna-session';
const TOKEN_KEY = 'luna-access-token';
const ROLE_KEY = 'luna-role';

const roleMap: Record<string, UserRole> = {
  admin: 'Admin',
  manager: 'Manager',
  supervisor: 'Supervisor',
  user: 'User',
};

function normalizeRole(role?: string): UserRole {
  if (!role) {
    return 'User';
  }

  return roleMap[role.trim().toLowerCase()] ?? 'User';
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.warn('Failed to load access token', error);
    return null;
  }
}

export async function signIn(employeeId: string, password: string): Promise<AuthResult> {
  const normalizedEmployeeId = employeeId.trim();
  const normalizedPassword = password.trim();

  if (!normalizedEmployeeId || !normalizedPassword) {
    return {
      success: false,
      message: 'Enter both employee ID and password.',
    };
  }

  if (!AUTH_LOGIN_URL) {
    return {
      success: false,
      message: 'EXPO_PUBLIC_API_BASE_URL is not configured. Set the LAN IP in your environment before signing in.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(AUTH_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        employee_id: normalizedEmployeeId,
        password: normalizedPassword,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok) {
      const detail =
        typeof payload.detail === 'string' ? payload.detail : 'Invalid employee ID or password.';

      return {
        success: false,
        message: response.status === 401 ? 'Invalid employee ID or password.' : detail,
      };
    }

    const token = typeof payload.access_token === 'string' ? payload.access_token : '';
    const role = normalizeRole(typeof payload.role === 'string' ? payload.role : 'User');
    const backendName =
      typeof payload.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : undefined;
    const backendDepartment =
      typeof payload.department === 'string' && payload.department.trim().length > 0 ? payload.department.trim() : 'Operations';

    if (!token) {
      return {
        success: false,
        message: 'Login succeeded but the token was missing from the API response.',
      };
    }

    const user: SessionUser = {
      name: backendName ?? `Employee ${normalizedEmployeeId}`,
      employeeId: normalizedEmployeeId,
      role,
      department: backendDepartment,
    };

    await persistSession(user, token);

    return {
      success: true,
      user,
      token,
      role,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'The login request timed out. Check that the backend is running and the API URL is correct.',
      };
    }

    console.warn('Login request failed', error);

    return {
      success: false,
      message: 'Unable to reach the Luna API. Confirm the backend is running and the device IP is correct.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function loadStoredSession(): Promise<SessionUser | null> {
  try {
    const token = await getAccessToken();
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!token || !raw) {
      await clearSession();
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SessionUser>;

    if (!parsed.employeeId) {
      await clearSession();
      return null;
    }

    return {
      name: parsed.name ?? `Employee ${parsed.employeeId}`,
      employeeId: parsed.employeeId,
      role: normalizeRole(parsed.role),
      department: parsed.department ?? 'Operations',
    };
  } catch (error) {
    console.warn('Failed to load stored session', error);
    await clearSession();
    return null;
  }
}

export async function persistSession(user: SessionUser, token?: string) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  await AsyncStorage.setItem(ROLE_KEY, user.role);

  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function updateSessionRole(role: UserRole, currentUser: SessionUser | null) {
  if (!currentUser) {
    return;
  }

  const nextUser = { ...currentUser, role };
  await persistSession(nextUser);
  return nextUser;
}

export async function clearSession() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(ROLE_KEY);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
