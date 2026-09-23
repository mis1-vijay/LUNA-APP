export type PortalRole = 'Admin' | 'Manager' | 'Supervisor' | 'User';

export type WebAppItem = {
  id?: string;
  title: string;
  subtitle: string;
  accent: string;
  access: PortalRole[];
  url?: string;
};

export type DepartmentItem = {
  name: string;
  tags: string[];
  accent: string;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  access: PortalRole[];
};

export type PortalResource = {
  id?: string;
  title: string;
  subtitle: string;
  meta: 'Report' | 'Form' | 'Sheet' | 'Admin';
  url?: string;
  accent: string;
  role: PortalRole | 'All';
  category: 'Web App' | 'Department' | 'Report' | 'Admin';
};

export const resolveAppUrl = (_title: string, fallback?: string) => {
  const value = fallback?.trim() ?? '';
  return !value ? '' : /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

export const webApps: WebAppItem[] = [
  {
    title: 'Task Manager',
    subtitle: 'Daily task planning and execution',
    accent: '#5e1232',
    access: ['User', 'Manager', 'Supervisor', 'Admin'],
    url: resolveAppUrl('Task Manager'),
  },
  {
    title: 'Stock Query',
    subtitle: 'Material and inventory visibility',
    accent: '#1d4ed8',
    access: ['Manager', 'Supervisor', 'Admin'],
    url: resolveAppUrl('Stock Query'),
  },
  {
    title: 'Packing Photos',
    subtitle: 'Packing and dispatch visual checks',
    accent: '#2563eb',
    access: ['User', 'Supervisor', 'Admin'],
    url: resolveAppUrl('Packing Photos'),
  },
  {
    title: 'Production Board',
    subtitle: 'Line performance and bottlenecks',
    accent: '#0ea5e9',
    access: ['Supervisor', 'Manager', 'Admin'],
    url: resolveAppUrl('Production Board'),
  },
  {
    title: 'Quality Tracker',
    subtitle: 'Defect and compliance monitoring',
    accent: '#0f766e',
    access: ['User', 'Supervisor', 'Manager', 'Admin'],
    url: resolveAppUrl('Quality Tracker'),
  },
];

export const departments: DepartmentItem[] = [
  {
    name: 'Automation',
    tags: ['Forms', 'Reports'],
    accent: '#38bdf8',
    summary: '12 active tasks',
    metrics: [
      { label: 'Shift Output', value: '86%' },
      { label: 'Pending Forms', value: '07' },
    ],
    access: ['Supervisor', 'Admin', 'Manager'],
  },
  {
    name: 'Hiwin',
    tags: ['Forms', 'Reports'],
    accent: '#22c55e',
    summary: '9 active tasks',
    metrics: [
      { label: 'On-Time', value: '92%' },
      { label: 'Open Issues', value: '03' },
    ],
    access: ['User', 'Supervisor', 'Admin'],
  },
  {
    name: 'Cutting',
    tags: ['Forms', 'Reports'],
    accent: '#f59e0b',
    summary: '15 active tasks',
    metrics: [
      { label: 'Yield', value: '88%' },
      { label: 'Alerts', value: '05' },
    ],
    access: ['Supervisor', 'Manager', 'Admin'],
  },
  {
    name: 'Machining',
    tags: ['Forms', 'Reports'],
    accent: '#f97316',
    summary: '18 active tasks',
    metrics: [
      { label: 'Utilization', value: '81%' },
      { label: 'PM Due', value: '02' },
    ],
    access: ['User', 'Supervisor', 'Admin'],
  },
  {
    name: 'Packing',
    tags: ['Forms', 'Reports', 'Sheets'],
    accent: '#0f172a',
    summary: '10 active tasks',
    metrics: [
      { label: 'Dispatch Pace', value: '78%' },
      { label: 'Pending Packs', value: '06' },
    ],
    access: ['User', 'Supervisor', 'Manager', 'Admin'],
  },
  {
    name: 'RFD',
    tags: ['Forms', 'Reports'],
    accent: '#a78bfa',
    summary: '6 active tasks',
    metrics: [
      { label: 'Cycle Time', value: '4.6h' },
      { label: 'Pending', value: '04' },
    ],
    access: ['Manager', 'Admin'],
  },
  {
    name: 'Invoice',
    tags: ['Forms', 'Reports'],
    accent: '#ef4444',
    summary: '11 active tasks',
    metrics: [
      { label: 'Cleared', value: '74%' },
      { label: 'Due Today', value: '09' },
    ],
    access: ['Manager', 'Admin'],
  },
  {
    name: 'Dispatch',
    tags: ['Forms', 'Reports'],
    accent: '#06b6d4',
    summary: '14 active tasks',
    metrics: [
      { label: 'Outbound', value: '63%' },
      { label: 'Delayed', value: '02' },
    ],
    access: ['User', 'Supervisor', 'Admin'],
  },
];

export const reports: PortalResource[] = [
  {
    title: 'Daily Production Summary',
    subtitle: 'Latest update from the floor',
    meta: 'Report',
    accent: '#22c55e',
    role: 'User',
    category: 'Report',
  },
  {
    title: 'Gate Pass Register',
    subtitle: 'Vehicle and dispatch tracking',
    meta: 'Form',
    accent: '#a78bfa',
    role: 'Supervisor',
    category: 'Report',
  },
  {
    title: 'Equipment Downtime Log',
    subtitle: 'Trend and maintenance notes',
    meta: 'Report',
    accent: '#f59e0b',
    role: 'Manager',
    category: 'Report',
  },
  {
    title: 'Maintenance Checksheet',
    subtitle: 'Machine readiness and preventive maintenance sign-off',
    meta: 'Form',
    accent: '#0284c7',
    role: 'User',
    category: 'Report',
  },
  {
    title: 'Material Transfer Log',
    subtitle: 'Inter-department movement and dispatch tracking',
    meta: 'Form',
    accent: '#f97316',
    role: 'Manager',
    category: 'Report',
  },
  {
    title: 'Safety Alert Log',
    subtitle: 'Risk and compliance incident records',
    meta: 'Report',
    accent: '#ef4444',
    role: 'Supervisor',
    category: 'Report',
  },
];

export const adminResources: PortalResource[] = [
  {
    title: 'User Access Matrix',
    subtitle: 'Role and department mapping',
    meta: 'Admin',
    accent: '#0284c7',
    role: 'Admin',
    category: 'Admin',
  },
  {
    title: 'System Audit',
    subtitle: 'Recent operational review log',
    meta: 'Admin',
    accent: '#0f172a',
    role: 'Manager',
    category: 'Admin',
  },
  {
    title: 'Vendor & Supplier List',
    subtitle: 'Approved production partners',
    meta: 'Admin',
    accent: '#7c3aed',
    role: 'Admin',
    category: 'Admin',
  },
  {
    title: 'Coming Soon: Attendance',
    subtitle: 'HRM attendance entry and attendance history',
    meta: 'Admin',
    accent: '#f59e0b',
    role: 'User',
    category: 'Admin',
  },
  {
    title: 'Coming Soon: Approvals',
    subtitle: 'Leave, purchase and compliance approvals',
    meta: 'Admin',
    accent: '#10b981',
    role: 'Manager',
    category: 'Admin',
  },
  {
    title: 'Coming Soon: Alerts',
    subtitle: 'Operational, safety and escalation alerts',
    meta: 'Admin',
    accent: '#ef4444',
    role: 'Supervisor',
    category: 'Admin',
  },
];

export const favorites = [
  { title: 'LMS', category: 'Web App', accent: '#0284c7' },
  { title: 'Automation', category: 'Department', accent: '#38bdf8' },
  { title: 'Daily Production Summary', category: 'Report', accent: '#22c55e' },
];

export const getVisibleAdminResources = (role: PortalRole) =>
  role === 'Admin' || role === 'Manager' ? adminResources : [];

export const getDepartmentByName = (name: string) =>
  departments.find((department) => department.name === name) ?? departments[0];

export const getCatalogItemKey = (category: string, title: string) => `${category}:${title}`;

export const getSearchCatalog = () => [
  ...webApps.map((app) => ({
    title: app.title,
    category: 'Web App',
    role: app.access,
    accent: app.accent,
  })),
  ...departments.map((department) => ({
    title: department.name,
    category: 'Department',
    role: department.access,
    accent: department.accent,
  })),
  ...reports.map((resource) => ({
    title: resource.title,
    category: resource.category,
    role: [resource.role],
    accent: resource.accent,
  })),
  ...adminResources.map((resource) => ({
    title: resource.title,
    category: resource.category,
    role: [resource.role],
    accent: resource.accent,
  })),
];

export const getAppDetailTiles = (appName: string) => {
  const app = webApps.find((item) => item.title === appName);

  if (!app) {
    return [
      { title: 'Open App', value: 'Launch' },
      { title: 'Users', value: '184' },
      { title: 'Alerts', value: '03' },
      { title: 'Updated', value: 'Today' },
    ];
  }

  const byApp: Record<string, Array<{ title: string; value: string }>> = {
    LMS: [
      { title: 'Open App', value: 'Launch' },
      { title: 'Users', value: '186' },
      { title: 'Alerts', value: '04' },
      { title: 'Updated', value: 'Today' },
    ],
    HRMS: [
      { title: 'Open App', value: 'Launch' },
      { title: 'Users', value: '94' },
      { title: 'Alerts', value: '02' },
      { title: 'Updated', value: 'Today' },
    ],
    MES: [
      { title: 'Open App', value: 'Launch' },
      { title: 'Users', value: '62' },
      { title: 'Alerts', value: '05' },
      { title: 'Updated', value: 'Today' },
    ],
    QMS: [
      { title: 'Open App', value: 'Launch' },
      { title: 'Users', value: '48' },
      { title: 'Alerts', value: '03' },
      { title: 'Updated', value: 'Today' },
    ],
  };

  return byApp[app.title] ?? [
    { title: 'Open App', value: 'Launch' },
    { title: 'Users', value: '184' },
    { title: 'Alerts', value: '03' },
    { title: 'Updated', value: 'Today' },
  ];
};
