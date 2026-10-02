import { API_BASE_URL } from '../config/api';
import type { PortalRole } from '../data/portalData';
import { clearSession, getAccessToken } from './authService';

type DashboardResource = {
  id?: number | string;
  title?: string;
  description?: string;
  subtitle?: string;
  meta?: string;
  accent?: string;
  category?: string;
  required_role?: string;
  access?: string[];
  role?: string;
  department_id?: number | string | null;
  type?: string;
  url?: string;
  link?: string;
  icon?: string;
};

type DashboardDepartment = {
  id?: number | string;
  name?: string;
  tags?: string[];
  accent?: string;
  summary?: string;
  quickAccess?: string[];
  metrics?: Array<{ label: string; value: string }>;
  access?: string[];
  icon?: string;
  sort_order?: number;
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

const buildDepartmentCard = (department: DashboardDepartment): { name: string; tags: string[]; accent: string; summary: string; metrics: Array<{ label: string; value: string }>; access: PortalRole[] } => {
  const name = department.name ?? 'Department';
  const roleAccess = normalizeAccessList(department.access);

  return {
    name,
    tags: department.tags ?? ['Reports', 'Forms'],
    accent: department.accent ?? departmentAccentMap[name] ?? '#0284c7',
    summary: department.summary ?? `${name} overview`,
    metrics: department.metrics ?? [{ label: 'Status', value: 'Live' }],
    access: roleAccess,
  };
};

export async function fetchDashboardData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error('No auth token available. Please sign in again.');
    }

    if (!API_BASE_URL) {
      throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured. Restart the app with start-luna.ps1.');
    }

    const response = await fetch(`${API_BASE_URL}/api/portal/dashboard`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail ?? 'Unable to load dashboard data.');
    }

    const payload = await response.json();
    const resources: DashboardResource[] = Array.isArray(payload.resources) ? payload.resources : [];
    const departments: DashboardDepartment[] = Array.isArray(payload.departments) ? payload.departments : [];

  const dashboardResources = resources.map((resource) => ({
    ...resource,
    type: (resource.type ?? resource.category ?? 'report').toString().trim().toLowerCase(),
    required_role: resource.required_role ?? resource.role ?? 'User',
    subtitle: resource.subtitle ?? resource.description ?? 'Portal item',
    url: resource.url ?? resource.link ?? undefined,
    link: resource.link ?? resource.url ?? undefined,
    meta: resource.meta ?? (resource.type === 'form' ? 'Form' : resource.type === 'webapp' ? 'Report' : 'Report'),
  }));

    return {
      webApps: dashboardResources
        .filter((resource) => resource.type === 'webapp')
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
        .filter((resource) => resource.type === 'report' || resource.type === 'form' || resource.type === 'sheet')
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
        .filter((resource) => resource.type === 'admin' || normalizePortalRole(resource.required_role ?? 'User') === 'Admin')
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
      favorites: dashboardResources.slice(0, 3).map((resource) => ({
        title: resource.title ?? 'Favorite Item',
        category: resource.type === 'webapp' ? 'Web App' : resource.type === 'form' ? 'Report' : 'Report',
        accent: resource.accent ?? '#0284c7',
      })),
    };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error(`Dashboard request timed out. Connect your phone to the same Wi-Fi and confirm ${API_BASE_URL}/docs opens, then retry.`);
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
      category: 'Web App' as const,
      role: app.access.map((role) => role.toLowerCase()),
      accent: app.accent,
    })),
    ...dashboard.departments.map((department) => ({
      title: department.name,
      category: 'Department' as const,
      role: department.access.map((role) => role.toLowerCase()),
      accent: department.accent,
    })),
    ...dashboard.reports.map((report) => ({
      title: report.title,
      category: 'Report' as const,
      role: [report.role.toLowerCase()],
      accent: report.accent,
    })),
    ...dashboard.adminResources.map((resource) => ({
      title: resource.title,
      category: 'Admin' as const,
      role: [resource.role.toLowerCase()],
      accent: resource.accent,
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
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.detail ?? 'Request failed.');
    }

    return payload as T;
  } catch (error) {
    const message = normalizeApiError(error, 'Unable to reach the Luna API. Please try again later.');

    if (/invalid or expired token|unauthorized|401|403/i.test(message)) {
      await clearSession();
      throw new Error('Your session expired. Please sign in again.');
    }

    throw new Error(message || 'Unable to reach the Luna API. Please try again later.');
  }
}

export async function fetchAdminUsers() {
  return requestBackend<Array<Record<string, unknown>>>('/api/admin/users', 'GET');
}

export type AdminResourceRecord = {
  id: string;
  title: string;
  description: string;
  type: 'webapp' | 'report' | 'form' | 'sheet';
  url: string;
  icon: string;
  department_id: string | null;
  required_role: 'Admin' | 'Manager' | 'Supervisor' | 'User';
};

export async function fetchAdminResources() {
  return requestBackend<AdminResourceRecord[]>('/api/admin/resources', 'GET');
}

export async function fetchAdminDepartments() {
  return requestBackend<Array<{ id: string; name: string; sort_order: number }>>('/api/admin/departments', 'GET');
}

export async function createAdminUser(user: AdminUserPayload) {
  return requestBackend<Record<string, unknown>>('/api/admin/users', 'POST', {
    employee_id: user.employeeId,
    name: user.name,
    password: user.password ?? 'luna123',
    role: user.role,
    department: user.department ?? 'Operations',
    active: user.active ?? true,
    email: user.email ?? `${user.employeeId.trim().toUpperCase()}@LUNA.CO.IN`,
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
  return requestBackend<Record<string, unknown>>('/api/admin/departments', 'POST', {
    name,
    icon: 'folder',
    sort_order: sortOrder,
  });
}

export async function updateDepartmentRecord(departmentId: string, updates: { name?: string; icon?: string; sort_order?: number }) {
  return requestBackend<Record<string, unknown>>(`/api/admin/departments/${encodeURIComponent(departmentId)}`, 'PUT', updates);
}

export async function deleteDepartmentRecord(departmentId: string) {
  return requestBackend<Record<string, unknown>>(`/api/admin/departments/${encodeURIComponent(departmentId)}`, 'DELETE');
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

  return requestBackend<Record<string, unknown>>('/api/admin/resources', 'POST', {
    title: data.title,
    description: data.description ?? '',
    type: resourceType,
    category: resourceType,
    url: data.url ?? data.link ?? null,
    link: data.link ?? data.url ?? null,
    icon: data.icon ?? 'star',
    department_id: data.department_id ?? null,
    required_role: data.required_role ?? 'User',
  });
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
    payload.category = nextType;
  }

  return requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(id)}`, 'PUT', payload);
}

export async function deleteModule(id: string) {
  return requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(id)}`, 'DELETE');
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

  return requestBackend<Record<string, unknown>>('/api/admin/resources', 'POST', {
    title: resource.title,
    description: resource.description ?? '',
    type: resourceType,
    category: resourceType,
    url: resource.url ?? resource.link ?? null,
    link: resource.link ?? resource.url ?? null,
    icon: resource.icon ?? 'star',
    department_id: resource.department_id ?? null,
    required_role: resource.required_role ?? 'User',
  });
}

export async function updateResourceRecord(resourceId: string, updates: Partial<ResourceMutation>) {
  const payload: Record<string, unknown> = { ...updates };

  if (typeof payload.type !== 'undefined' || typeof payload.category !== 'undefined') {
    const nextType = normalizeResourceType((payload.category as string | undefined) ?? (payload.type as string | undefined) ?? 'webapp');
    payload.type = nextType;
    payload.category = nextType;
  }

  return requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(resourceId)}`, 'PUT', payload);
}

export async function deleteResourceRecord(resourceId: string) {
  return requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(resourceId)}`, 'DELETE');
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
