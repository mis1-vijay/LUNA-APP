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

export const webApps: WebAppItem[] = [];
export const departments: DepartmentItem[] = [];
export const reports: PortalResource[] = [];
export const adminResources: PortalResource[] = [];

export const favorites = [
  { title: 'LMS', category: 'Web App', accent: '#0284c7' },
  { title: 'Automation', category: 'Department', accent: '#38bdf8' },
  { title: 'Daily Production Summary', category: 'Report', accent: '#22c55e' },
];

export const getVisibleAdminResources = (role: PortalRole) =>
  role === 'Admin' ? adminResources : [];

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
