import { API_BASE_URL, API_REQUEST_TIMEOUT_MS } from '../config/api';
import type { DepartmentItem, PortalRole } from '../data/portalData';
import { clearSession, getAccessToken } from './authService';

type DashboardResource = {
  id?: number | string;
  title?: string;
  description?: string;
  subtitle?: string;
  meta?: string;
  accent?: string;
  category?: string;
  viewing_level?: string;
  access_level?: string;
  required_role?: string;
  access?: string[];
  role?: string;
  department_id?: number | string | { id?: number | string; name?: string; title?: string } | null;
  department?: string | number | { id?: number | string; name?: string; title?: string } | null;
  type?: string;
  url?: string;
  link?: string;
  icon?: string;
};

type DashboardDepartment = {
  id?: number | string;
  name?: string;
  title?: string;
  tags?: string[];
  accent?: string;
  summary?: string;
  quickAccess?: string[];
  metrics?: Array<{ label: string; value: string }>;
  access?: string[];
  icon?: string;
  sort_order?: number;
};

export type DashboardDepartmentResource = {
  id: string;
  departmentId: string;
  type: 'webApp' | 'report' | 'form' | 'resource';
  title: string;
  subtitle: string;
  accent: string;
  link: string;
  access: PortalRole[];
  department: string;
};

const departmentAccentMap: Record<string, string> = {
  Automation: '#38bdf8',
  Hiwin: '#22c55e',
  Cutting: '#f59e0b',
  Machining: '#f97316',
  Packing: '#0f172a',
  RFD: '#a78bfa',
  Invoice: '#ef4444',
  Dispatch: '#06b6d4',
};

const normalizePortalRole = (value?: string): PortalRole => {
  switch (value?.trim().toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'supervisor':
      return 'Supervisor';
    case 'employee':
    case 'user':
    default:
      return 'User';
  }
};

const normalizeMeta = (value?: string): 'Report' | 'Form' | 'Admin' => {
  switch (value?.trim().toLowerCase()) {
    case 'form':
      return 'Form';
    case 'admin':
      return 'Admin';
    default:
      return 'Report';
  }
};

const normalizeAccessList = (value?: string | string[]): PortalRole[] => {
  if (Array.isArray(value)) {
    return value.map(normalizePortalRole);
  }

  if (typeof value === 'string') {
    return [normalizePortalRole(value)];
  }

  return ['User'];
};

const normalizeApiError = (error: unknown, fallback = 'Unable to reach the Luna API. Please try again later.') => {
  if (error instanceof Error) {
    const message = error.message.trim();

    if (!message) {
      return fallback;
    }

    if (/network|failed to fetch|load failed|timed out|connection|unreachable|offline/i.test(message)) {
      return 'Unable to connect to the Luna API. Please check your connection and try again.';
    }

    return message;
  }

  return fallback;
};

const buildDepartmentCard = (department: DashboardDepartment): DepartmentItem => {
  const name = department.name ?? department.title ?? 'Department';
  const roleAccess = normalizeAccessList(department.access);

  return {
    id: department.id == null ? undefined : String(department.id),
    name,
    tags: department.tags ?? ['Reports', 'Forms'],
    accent: department.accent ?? departmentAccentMap[name] ?? '#0284c7',
    summary: department.summary ?? `${name} overview`,
    metrics: department.metrics ?? [{ label: 'Status', value: 'Live' }],
    access: roleAccess,
  };
};

const DASHBOARD_CACHE_TTL_MS = 30_000;

type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;
let dashboardCache: { token: string; expiresAt: number; data: DashboardData } | null = null;
let dashboardRequest: { token: string; version: number; promise: Promise<DashboardData> } | null = null;
let dashboardCacheVersion = 0;

function invalidateDashboardCache() {
  dashboardCacheVersion += 1;
  dashboardCache = null;
  dashboardRequest = null;
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const token = await getAccessToken();
  if (!token) {
    invalidateDashboardCache();
    throw new Error('No auth token available. Please sign in again.');
  }

  const cachedToken = dashboardCache?.token ?? dashboardRequest?.token;
  if (cachedToken && cachedToken !== token) {
    invalidateDashboardCache();
  }

  const now = Date.now();
  if (dashboardCache?.token === token && dashboardCache.expiresAt > now) {
    return dashboardCache.data;
  }

  const version = dashboardCacheVersion;
  if (dashboardRequest?.token === token && dashboardRequest.version === version) {
    return dashboardRequest.promise;
  }

  const promise = loadDashboardData(token);
  dashboardRequest = { token, version, promise };
  try {
    const data = await promise;
    if (dashboardCacheVersion === version) {
      dashboardCache = { token, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS, data };
    }
    return data;
  } finally {
    if (dashboardRequest?.promise === promise) {
      dashboardRequest = null;
    }
  }
}

async function loadDashboardData(token: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    if (!API_BASE_URL) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured. Restart the app with start-luna.ps1.');
    }

    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const [resourcesResponse, departmentsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/resources`, { method: 'GET', headers, signal: controller.signal }),
      fetch(`${API_BASE_URL}/api/admin/departments`, { method: 'GET', headers, signal: controller.signal }),
    ]);

    if (!resourcesResponse.ok || !departmentsResponse.ok) {
      const failedResponse = !resourcesResponse.ok ? resourcesResponse : departmentsResponse;
      const body = await failedResponse.json().catch(() => ({}));
      throw new Error(body.detail ?? 'Unable to load dashboard data.');
    }

    const [resourcePayload, departmentPayload] = await Promise.all([
      resourcesResponse.json(),
      departmentsResponse.json(),
    ]);
    const resources: DashboardResource[] = Array.isArray(resourcePayload) ? resourcePayload : [];
    const departments: DashboardDepartment[] = Array.isArray(departmentPayload) ? departmentPayload : [];
    const departmentsById = new Map(
      departments
        .filter((department) => department.id != null && (department.name || department.title))
        .map((department) => [String(department.id).toLowerCase(), department]),
    );
    const resolveDepartmentId = (association: DashboardResource['department_id']) => {
      if (association == null) return undefined;
      const value = typeof association === 'object' ? association.id : association;
      if (value == null || !String(value).trim()) return undefined;
      return departmentsById.get(String(value).trim().toLowerCase());
    };

    const dashboardResources = resources.map((resource) => ({
      ...resource,
      type: (resource.type ?? resource.category ?? 'report').toString().trim().toLowerCase(),
      required_role: resource.viewing_level ?? resource.access_level ?? resource.required_role ?? resource.role ?? 'User',
      subtitle: resource.subtitle ?? resource.description ?? 'Portal item',
      url: resource.url ?? resource.link ?? undefined,
      link: resource.link ?? resource.url ?? undefined,
      meta: resource.meta ?? (resource.type === 'form' ? 'Form' : resource.type === 'webapp' ? 'Report' : 'Report'),
    }));

    const departmentResources: DashboardDepartmentResource[] = dashboardResources.flatMap((resource) => {
      const department = resolveDepartmentId(resource.department_id);
      if (!department) {
        return [];
      }
      const departmentId =
        department.id == null ? undefined : String(department.id);
      if (!departmentId) return [];

      const type: DashboardDepartmentResource['type'] =
        resource.type === 'webapp' ? 'webApp' : resource.type === 'form' ? 'form' : resource.type === 'report' || resource.type === 'sheet' ? 'report' : 'resource';

      return [{
        id: resource.id == null ? '' : String(resource.id),
        departmentId,
        type,
        title: resource.title ?? 'Portal resource',
        subtitle: resource.subtitle,
        accent: resource.accent ?? '#0284c7',
        link: resource.url ?? '',
        access: normalizeAccessList(resource.required_role),
        department: department.name ?? department.title ?? '',
      }];
    });

    return {
      departmentResources,
      webApps: dashboardResources
        .filter(
          (resource) =>
            resource.type === 'webapp' &&
            normalizePortalRole(resource.required_role ?? 'User') !== 'Admin',
        )
        .map((resource) => ({
          id: resource.id == null ? undefined : String(resource.id),
          title: resource.title ?? 'Portal App',
          subtitle: resource.subtitle ?? 'Portal access',
          accent: resource.accent ?? '#0284c7',
          access: normalizeAccessList(resource.required_role),
          url: resource.url ?? undefined,
        })),
      departments: departments.map(buildDepartmentCard),
      reports: dashboardResources
        .filter((resource) =>
          resource.type !== 'webapp' &&
          resource.type !== 'admin' &&
          normalizePortalRole(resource.required_role ?? 'User') !== 'Admin',
        )
        .map((resource) => ({
          id: resource.id == null ? undefined : String(resource.id),
          title: resource.title ?? 'Report',
          subtitle: resource.subtitle ?? 'Portal report',
          meta: resource.type === 'form' ? 'Form' as const : resource.type === 'sheet' ? 'Sheet' as const : normalizeMeta('report'),
          accent: resource.accent ?? '#22c55e',
          role: normalizePortalRole(resource.required_role ?? 'User'),
          category: 'Report' as const,
          url: resource.url ?? undefined,
        })),
      adminResources: dashboardResources
        .filter((resource) =>
          (resource.type === 'admin' || normalizePortalRole(resource.required_role ?? 'User') === 'Admin') &&
          resource.title?.trim().toLowerCase() !== 'user access matrix',
        )
        .map((resource) => ({
          id: resource.id == null ? undefined : String(resource.id),
          title: resource.title ?? 'Admin Resource',
          subtitle: resource.subtitle ?? 'Admin access',
          meta: 'Admin' as const,
          accent: resource.accent ?? '#0f172a',
          role: normalizePortalRole(resource.required_role ?? 'Admin'),
          category: 'Admin' as const,
          url: resource.url ?? undefined,
        })),
      favorites: [
        ...dashboardResources.filter((resource) => resource.title?.trim().toLowerCase() !== 'user access matrix').map((resource) => {
          const requiredRole = normalizePortalRole(resource.required_role ?? 'User');
          return {
            title: resource.title ?? 'Resource',
            category: requiredRole === 'Admin' || resource.type === 'admin'
              ? 'Admin'
              : resource.type === 'webapp'
                ? 'Web App'
                : 'Report',
            accent: resource.accent ?? '#0284c7',
            subtitle: resource.subtitle ?? 'Portal resource',
            url: resource.url ?? undefined,
          };
        }),
        ...departments.map((department) => ({
          title: department.name ?? 'Department',
          category: 'Department',
          accent: department.accent ?? departmentAccentMap[department.name ?? ''] ?? '#0284c7',
          subtitle: department.summary ?? `${department.name ?? 'Department'} workspace`,
        })),
      ],
    };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error(`Dashboard request timed out after ${API_REQUEST_TIMEOUT_MS / 1000} seconds. Connect your phone to the same Wi-Fi and confirm ${API_BASE_URL}/docs opens, then retry.`);
    }

    throw new Error(normalizeApiError(error, 'Unable to load dashboard data.'));
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchFavoritesData() {
  const dashboard = await fetchDashboardData();
  return dashboard.favorites;
}

export async function fetchSearchData() {
  const dashboard = await fetchDashboardData();

  return [
    ...dashboard.webApps.map((app) => ({
      title: app.title,
      subtitle: app.subtitle,
      category: 'Web App' as const,
      role: app.access.map((role) => role.toLowerCase()),
      accent: app.accent,
      url: app.url,
    })),
    ...dashboard.departments.map((department) => ({
      title: department.name,
      subtitle: department.summary,
      category: 'Department' as const,
      role: department.access.map((role) => role.toLowerCase()),
      accent: department.accent,
    })),
    ...dashboard.reports.map((report) => ({
      title: report.title,
      subtitle: report.subtitle,
      category: 'Report' as const,
      role: [report.role.toLowerCase()],
      accent: report.accent,
      url: report.url,
    })),
    ...dashboard.adminResources.map((resource) => ({
      title: resource.title,
      subtitle: resource.subtitle,
      category: 'Admin' as const,
      role: [resource.role.toLowerCase()],
      accent: resource.accent,
      url: resource.url,
    })),
  ];
}

export async function fetchDepartmentDetail(name: string) {
  const dashboard = await fetchDashboardData();
  return dashboard.departments.find((department) => department.name === name) ?? dashboard.departments[0];
}

export async function fetchAppDetail(name: string) {
  const dashboard = await fetchDashboardData();
  return dashboard.webApps.find((app) => app.title === name) ?? dashboard.webApps[0];
}

export type WorkspaceSettings = {
  favorites: string[];
  workspace_layout: Array<Record<string, unknown>>;
};

export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  const payload = await requestBackend<Record<string, unknown>>('/api/users/workspace', 'GET');
  const favorites = Array.isArray(payload.favorites) ? payload.favorites.filter((value): value is string => typeof value === 'string') : [];
  const workspaceLayout = Array.isArray(payload.workspace_layout)
    ? (payload.workspace_layout.filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null) as Array<Record<string, unknown>>)
    : [];

  return { favorites, workspace_layout: workspaceLayout };
}

export async function saveWorkspaceSettings(favorites: string[], workspaceLayout: Array<Record<string, unknown>> = []) {
  return requestBackend<Record<string, unknown>>('/api/users/workspace', 'PUT', {
    favorites,
    workspace_layout: workspaceLayout,
  });
}

export async function fetchCurrentUserProfile() {
  return requestBackend<Record<string, unknown>>('/api/users/me', 'GET');
}

export async function updateCurrentUserProfile(updates: {
  name?: string;
  department?: string;
  email?: string;
  phone?: string;
  favorites?: string[];
  workspace_layout?: Array<Record<string, unknown>>;
}) {
  return requestBackend<Record<string, unknown>>('/api/users/me', 'PUT', {
    name: updates.name,
    department: updates.department,
    email: updates.email,
    phone: updates.phone,
    favorite_departments: updates.favorites,
    workspace_layout: updates.workspace_layout,
  });
}

export type AdminUserPayload = {
  employeeId: string;
  name: string;
  password?: string;
  role: string;
  department?: string;
  active?: boolean;
  email?: string;
  phone?: string;
};

async function requestBackend<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: Record<string, unknown>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    if (!API_BASE_URL) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured.');
    }

    const token = await getAccessToken();

    if (!token) {
      throw new Error('No auth token available. Please sign in again.');
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;

    if (!response.ok) {
      const detail = [payload.detail, payload.message, payload.error].find(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      );
      throw new Error(detail ?? `Request failed with HTTP ${response.status}.`);
    }

    return payload as T;
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error(`API request timed out after ${API_REQUEST_TIMEOUT_MS / 1000} seconds.`);
    }

    const message = normalizeApiError(error, 'Unable to reach the Luna API. Please try again later.');

    if (/invalid or expired token|unauthorized|401|403/i.test(message)) {
      await clearSession();
      throw new Error('Your session expired. Please sign in again.');
    }

    throw new Error(message || 'Unable to reach the Luna API. Please try again later.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchDepartmentResources(departmentId?: string): Promise<DashboardDepartmentResource[]> {
  if (!departmentId) {
    return [];
  }
  const dashboard = await fetchDashboardData();
  return dashboard.departmentResources.filter((resource) => resource.departmentId === departmentId);
}

export type PortalNotification = {
  id: string;
  message: string;
  target_role_level: 'User' | 'Supervisor' | 'Manager' | 'Admin';
  created_at: string;
  is_read: boolean;
};

export async function fetchNotifications() {
  return requestBackend<PortalNotification[]>('/api/notifications', 'GET');
}

export async function fetchAdminUsers() {
  return requestBackend<Array<Record<string, unknown>>>('/api/users', 'GET');
}

export type AdminResourceRecord = {
  id: string;
  title: string;
  description: string;
  type: 'webapp' | 'report' | 'form' | 'sheet';
  url: string;
  icon: string;
  department_id: string | null;
  viewing_level: 'Admin' | 'Manager' | 'Supervisor' | 'User';
  required_role?: 'Admin' | 'Manager' | 'Supervisor' | 'User';
};

export async function fetchAdminResources() {
  return requestBackend<AdminResourceRecord[]>('/api/admin/resources', 'GET');
}

export type AuditLog = {
  id: string;
  actor_employee_id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export async function registerPushToken(expoPushToken: string) {
  return requestBackend<{ status: string }>('/api/push-tokens', 'POST', {
    expo_push_token: expoPushToken,
  });
}

export async function unregisterPushTokens() {
  return requestBackend<{ status: string }>('/api/push-tokens', 'DELETE');
}

export async function fetchAuditLogs() {
  return requestBackend<AuditLog[]>('/api/audit-logs', 'GET');
}

export async function fetchAdminDepartments() {
  return requestBackend<Array<{ id: string; name: string; sort_order: number }>>('/api/admin/departments', 'GET');
}

export async function createAdminUser(user: AdminUserPayload & { password: string }) {
  if (user.password.trim().length < 8) {
    throw new Error('An initial password of at least 8 characters is required.');
  }

  return requestBackend<Record<string, unknown>>('/api/admin/users', 'POST', {
    employee_id: user.employeeId,
    name: user.name,
    password: user.password.trim(),
    role: user.role,
    department: user.department ?? 'Operations',
    active: user.active ?? true,
    email: user.email?.trim() || undefined,
    phone: user.phone ?? 'Not set',
  });
}

export async function updateAdminUser(employeeId: string, updates: Partial<AdminUserPayload>) {
  const payload: Record<string, unknown> = {};

  if (updates.name) payload.name = updates.name;
  if (updates.role) payload.role = updates.role;
  if (updates.department) payload.department = updates.department;
  if (typeof updates.active === 'boolean') payload.active = updates.active;
  if (updates.password) payload.password = updates.password;
  if (updates.email) payload.email = updates.email;
  if (updates.phone) payload.phone = updates.phone;

  return requestBackend<Record<string, unknown>>(`/api/admin/users/${encodeURIComponent(employeeId)}`, 'PUT', payload);
}

export async function deleteAdminUser(employeeId: string) {
  return requestBackend<Record<string, unknown>>(`/api/admin/users/${encodeURIComponent(employeeId)}`, 'DELETE');
}

export async function createDepartmentRecord(name: string, sortOrder = 0) {
  const result = await requestBackend<Record<string, unknown>>('/api/admin/departments', 'POST', {
    name,
    icon: 'folder',
    sort_order: sortOrder,
  });
  invalidateDashboardCache();
  return result;
}

export async function updateDepartmentRecord(departmentId: string, updates: { name?: string; icon?: string; sort_order?: number }) {
  const result = await requestBackend<Record<string, unknown>>(`/api/admin/departments/${encodeURIComponent(departmentId)}`, 'PUT', updates);
  invalidateDashboardCache();
  return result;
}

export async function deleteDepartmentRecord(departmentId: string) {
  const result = await requestBackend<Record<string, unknown>>(`/api/admin/departments/${encodeURIComponent(departmentId)}`, 'DELETE');
  invalidateDashboardCache();
  return result;
}

export type ResourceCategory = 'webapp' | 'report' | 'form' | 'module' | 'department' | 'tiny' | 'sheet' | 'admin';

const normalizeResourceType = (value?: string): ResourceCategory => {
  const candidate = (value ?? 'webapp').toString().trim().toLowerCase();
  const aliases: Record<string, ResourceCategory> = {
    webapp: 'webapp',
    web_app: 'webapp',
    app: 'webapp',
    report: 'report',
    reports: 'report',
    form: 'form',
    forms: 'form',
    module: 'module',
    modules: 'module',
    department: 'department',
    departments: 'department',
    tiny: 'tiny',
    tiny_element: 'tiny',
    tiny_element_1: 'tiny',
    sheet: 'sheet',
    sheets: 'sheet',
    admin: 'admin',
  };

  return aliases[candidate] ?? (candidate as ResourceCategory);
};

export async function createModule(data: {
  title: string;
  description?: string;
  type?: ResourceCategory;
  category?: ResourceCategory;
  url?: string | null;
  link?: string | null;
  icon?: string;
  department_id?: string | null;
  required_role?: string;
}) {
  const resourceType = normalizeResourceType(data.category ?? data.type ?? 'webapp');

  const result = await requestBackend<Record<string, unknown>>('/api/admin/resources', 'POST', {
    title: data.title,
    description: data.description ?? '',
    type: resourceType,
    url: data.url ?? data.link ?? null,
    icon: data.icon ?? 'star',
    department_id: data.department_id ?? null,
    required_role: data.required_role ?? 'User',
  });
  invalidateDashboardCache();
  return result;
}

export async function updateModule(id: string, data: {
  title?: string;
  description?: string;
  type?: ResourceCategory;
  category?: ResourceCategory;
  url?: string | null;
  link?: string | null;
  icon?: string;
  department_id?: string | null;
  required_role?: string;
}) {
  const payload: Record<string, unknown> = { ...data };

  if (typeof payload.type !== 'undefined' || typeof payload.category !== 'undefined') {
    const nextType = normalizeResourceType((payload.category as string | undefined) ?? (payload.type as string | undefined) ?? 'webapp');
    payload.type = nextType;
  }
  if (typeof payload.url === 'undefined' && typeof payload.link !== 'undefined') payload.url = payload.link;
  delete payload.category;
  delete payload.link;

  const result = await requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(id)}`, 'PUT', payload);
  invalidateDashboardCache();
  return result;
}

export async function deleteModule(id: string) {
  const result = await requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(id)}`, 'DELETE');
  invalidateDashboardCache();
  return result;
}

export type ResourceMutation = {
  title: string;
  description?: string;
  type: ResourceCategory;
  category?: ResourceCategory;
  url?: string | null;
  link?: string | null;
  icon?: string;
  department_id?: string | null;
  required_role?: string;
};

export async function createResourceRecord(resource: ResourceMutation) {
  const resourceType = normalizeResourceType(resource.category ?? resource.type);

  const result = await requestBackend<Record<string, unknown>>('/api/admin/resources', 'POST', {
    title: resource.title,
    description: resource.description ?? '',
    type: resourceType,
    url: resource.url ?? resource.link ?? null,
    icon: resource.icon ?? 'star',
    department_id: resource.department_id ?? null,
    required_role: resource.required_role ?? 'User',
  });
  invalidateDashboardCache();
  return result;
}

export async function updateResourceRecord(resourceId: string, updates: Partial<ResourceMutation>) {
  const payload: Record<string, unknown> = { ...updates };

  if (typeof payload.type !== 'undefined' || typeof payload.category !== 'undefined') {
    const nextType = normalizeResourceType((payload.category as string | undefined) ?? (payload.type as string | undefined) ?? 'webapp');
    payload.type = nextType;
  }
  if (typeof payload.url === 'undefined' && typeof payload.link !== 'undefined') payload.url = payload.link;
  delete payload.category;
  delete payload.link;

  const result = await requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(resourceId)}`, 'PUT', payload);
  invalidateDashboardCache();
  return result;
}

export async function deleteResourceRecord(resourceId: string) {
  const result = await requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(resourceId)}`, 'DELETE');
  invalidateDashboardCache();
  return result;
}

export async function createCustomModuleRecord(module: {
  id?: string;
  type: 'webApp' | 'department' | 'report' | 'resource' | 'webapp' | 'form' | 'module' | 'tiny';
  title: string;
  subtitle: string;
  accent: string;
  link: string;
  access: string[];
  department?: string;
}) {
  const resourceType = normalizeResourceType(module.type === 'webApp' ? 'webapp' : module.type === 'department' ? 'department' : module.type === 'report' ? 'report' : module.type === 'resource' ? 'module' : module.type === 'form' ? 'form' : module.type === 'module' ? 'module' : module.type === 'tiny' ? 'tiny' : 'webapp');

  return createResourceRecord({
    title: module.title,
    description: module.subtitle,
    type: resourceType,
    category: resourceType,
    url: module.link,
    icon: resourceType === 'webapp' ? 'web' : resourceType === 'report' ? 'file-text' : resourceType === 'form' ? 'file' : resourceType === 'module' ? 'grid' : resourceType === 'tiny' ? 'sparkles' : 'folder',
    required_role: module.access.includes('Admin') ? 'Admin' : module.access.includes('Manager') ? 'Manager' : module.access.includes('Supervisor') ? 'Supervisor' : 'User',
  });
}

export async function updateCustomModuleRecord(module: {
  id?: string;
  type: 'webApp' | 'department' | 'report' | 'resource' | 'webapp' | 'form' | 'module' | 'tiny';
  title: string;
  subtitle: string;
  accent: string;
  link: string;
  access: string[];
  department?: string;
}) {
  if (!module.id) {
    throw new Error('Module id is required to update.');
  }

  const resourceType = normalizeResourceType(module.type === 'webApp' ? 'webapp' : module.type === 'department' ? 'department' : module.type === 'report' ? 'report' : module.type === 'resource' ? 'module' : module.type === 'form' ? 'form' : module.type === 'module' ? 'module' : module.type === 'tiny' ? 'tiny' : 'webapp');

  return updateResourceRecord(module.id, {
    title: module.title,
    description: module.subtitle,
    type: resourceType,
    category: resourceType,
    url: module.link,
    icon: resourceType === 'webapp' ? 'web' : resourceType === 'report' ? 'file-text' : resourceType === 'form' ? 'file' : resourceType === 'module' ? 'grid' : resourceType === 'tiny' ? 'sparkles' : 'folder',
    required_role: module.access.includes('Admin') ? 'Admin' : module.access.includes('Manager') ? 'Manager' : module.access.includes('Supervisor') ? 'Supervisor' : 'User',
  });
}

export async function deleteCustomModuleRecord(module: { id?: string; type: 'webApp' | 'department' | 'report' | 'resource' | 'webapp' | 'form' | 'module' | 'tiny' }) {
  if (!module.id) {
    throw new Error('Module id is required to delete.');
  }

  return deleteResourceRecord(module.id);
}
