const LIVE_API_BASE_URL = 'https://luna-app-ne5e.onrender.com';

function normalizeApiBaseUrl(value?: string): string {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const override = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);

  if (override) {
    return override;
  }

  return LIVE_API_BASE_URL;
}

export const API_BASE_URL = getApiBaseUrl();
export const AUTH_LOGIN_URL = API_BASE_URL ? `${API_BASE_URL}/api/auth/login` : '';
