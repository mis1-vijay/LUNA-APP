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
  const token = await getAccessToken();

  if (!token) {
    throw new Error('No auth token available. Please sign in again.');
  }

  const response = await fetch(`${API_BASE_URL}/api/portal/dashboard`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
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
        url: resource.url,
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
        url: resource.url,
      })),
    adminResources: dashboardResources
      .filter((resource) => resource.type === 'admin' || normalizePortalRole(resource.required_role ?? 'User') === 'Admin')
      .map((resource) => ({
        title: resource.title ?? 'Admin Resource',
        subtitle: resource.subtitle ?? 'Admin access',
        meta: 'Admin' as const,
        accent: resource.accent ?? '#0f172a',
        role: normalizePortalRole(resource.required_role ?? 'Admin'),
        category: 'Admin' as const,
      })),
    favorites: dashboardResources.slice(0, 3).map((resource) => ({
      title: resource.title ?? 'Favorite Item',
      category: resource.type === 'webapp' ? 'Web App' : resource.type === 'form' ? 'Report' : 'Report',
      accent: resource.accent ?? '#0284c7',
    })),
  };
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
    const message = error instanceof Error ? error.message : 'Unable to reach the Luna API. Please try again later.';

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

export async function createModule(data: {
  title: string;
  description?: string;
  type?: 'webapp' | 'report' | 'form';
  url?: string | null;
  icon?: string;
  department_id?: string | null;
  required_role?: string;
}) {
  return requestBackend<Record<string, unknown>>('/api/modules', 'POST', {
    title: data.title,
    description: data.description ?? '',
    type: data.type ?? 'webapp',
    url: data.url ?? null,
    icon: data.icon ?? 'star',
    department_id: data.department_id ?? null,
    required_role: data.required_role ?? 'User',
  });
}

export async function updateModule(id: string, data: {
  title?: string;
  description?: string;
  type?: 'webapp' | 'report' | 'form';
  url?: string | null;
  icon?: string;
  department_id?: string | null;
  required_role?: string;
}) {
  return requestBackend<Record<string, unknown>>(`/api/modules/${encodeURIComponent(id)}`, 'PUT', data);
}

export async function deleteModule(id: string) {
  return requestBackend<Record<string, unknown>>(`/api/modules/${encodeURIComponent(id)}`, 'DELETE');
}

export type ResourceMutation = {
  title: string;
  description?: string;
  type: 'webapp' | 'report' | 'form' | 'sheet';
  url?: string | null;
  icon?: string;
  department_id?: string | null;
  required_role?: string;
};

export async function createResourceRecord(resource: ResourceMutation) {
  return requestBackend<Record<string, unknown>>('/api/admin/resources', 'POST', {
    title: resource.title,
    description: resource.description ?? '',
    type: resource.type,
    url: resource.url ?? null,
    icon: resource.icon ?? 'star',
    department_id: resource.department_id ?? null,
    required_role: resource.required_role ?? 'User',
  });
}

export async function updateResourceRecord(resourceId: string, updates: Partial<ResourceMutation>) {
  return requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(resourceId)}`, 'PUT', updates);
}

export async function deleteResourceRecord(resourceId: string) {
  return requestBackend<Record<string, unknown>>(`/api/admin/resources/${encodeURIComponent(resourceId)}`, 'DELETE');
}

export async function createCustomModuleRecord(module: {
  id?: string;
  type: 'webApp' | 'department' | 'report' | 'resource';
  title: string;
  subtitle: string;
  accent: string;
  link: string;
  access: string[];
  department?: string;
}) {
  if (module.type === 'department') {
    return createDepartmentRecord(module.title, Date.now());
  }

  const resourceType: 'webapp' | 'report' | 'form' =
    module.type === 'webApp' ? 'webapp' : module.type === 'report' ? 'report' : 'form';

  return createResourceRecord({
    title: module.title,
    description: module.subtitle,
    type: resourceType,
    url: module.link,
    icon: resourceType === 'webapp' ? 'web' : resourceType === 'report' ? 'file-text' : 'file',
    required_role: module.access.includes('Admin') ? 'Admin' : module.access.includes('Manager') ? 'Manager' : module.access.includes('Supervisor') ? 'Supervisor' : 'User',
  });
}

export async function updateCustomModuleRecord(module: {
  id?: string;
  type: 'webApp' | 'department' | 'report' | 'resource';
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

  if (module.type === 'department') {
    return updateDepartmentRecord(module.id, {
      name: module.title,
      icon: module.accent,
      sort_order: Date.now(),
    });
  }

  const resourceType: 'webapp' | 'report' | 'form' =
    module.type === 'webApp' ? 'webapp' : module.type === 'report' ? 'report' : 'form';

  return updateResourceRecord(module.id, {
    title: module.title,
    description: module.subtitle,
    type: resourceType,
    url: module.link,
    icon: resourceType === 'webapp' ? 'web' : resourceType === 'report' ? 'file-text' : 'file',
    required_role: module.access.includes('Admin') ? 'Admin' : module.access.includes('Manager') ? 'Manager' : module.access.includes('Supervisor') ? 'Supervisor' : 'User',
  });
}

export async function deleteCustomModuleRecord(module: { id?: string; type: 'webApp' | 'department' | 'report' | 'resource' }) {
  if (!module.id) {
    throw new Error('Module id is required to delete.');
  }

  if (module.type === 'department') {
    return deleteDepartmentRecord(module.id);
  }

  return deleteResourceRecord(module.id);
}
