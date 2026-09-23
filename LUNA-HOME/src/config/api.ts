export function getApiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';

  if (!override) {
    return '';
  }

  const normalized = override.replace(/\/+$/, '');
  const lower = normalized.toLowerCase();

  if (lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('0.0.0.0')) {
    console.warn('Ignoring loopback API URL. Set EXPO_PUBLIC_API_BASE_URL to your LAN IP, e.g. http://192.168.0.189:8000');
    return '';
  }

  return normalized;
}

export const API_BASE_URL = getApiBaseUrl();
export const AUTH_LOGIN_URL = API_BASE_URL ? `${API_BASE_URL}/api/auth/login` : '';
