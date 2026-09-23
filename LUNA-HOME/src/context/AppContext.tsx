import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearSession,
  loadStoredSession,
  persistSession,
  signIn,
  type SessionUser,
  type UserRole,
} from '../services/authService';
import type { PortalRole } from '../data/portalData';
import {
  createAdminUser,
  createCustomModuleRecord,
  deleteAdminUser as deleteAdminUserRemote,
  fetchAdminUsers,
  updateAdminUser as updateAdminUserRemote,
} from '../services/portalApi';

export type CustomModule = {
  id: string;
  type: 'webApp' | 'department' | 'report' | 'resource';
  title: string;
  subtitle: string;
  accent: string;
  link: string;
  access: PortalRole[];
  department?: string;
};

export type AdminManagedUser = {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  role: UserRole;
  active: boolean;
  email: string;
  phone: string;
  password?: string;
};

type AppContextValue = {
  role: UserRole;
  setRole: (role: UserRole) => void;
  user: SessionUser | null;
  isAuthenticated: boolean;
  login: (employeeId: string, password: string) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  favorites: string[];
  toggleFavorite: (key: string) => void;
  isFavorite: (key: string) => boolean;
  customModules: CustomModule[];
  addCustomModule: (module: CustomModule) => void;
  removeCustomModule: (id: string) => void;
  adminUsers: AdminManagedUser[];
  refreshAdminUsers: () => Promise<void>;
  addAdminUser: (newUser: AdminManagedUser) => void;
  updateAdminUser: (id: string, updates: Partial<AdminManagedUser>) => void;
  deleteAdminUser: (id: string) => void;
};

const buildLunaEmail = (employeeId?: string, department?: string, name?: string) => {
  const cleaner = (value?: string) =>
    (value ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 20)
      .toUpperCase();

  const candidate = cleaner(employeeId) || cleaner(department) || cleaner(name) || 'EMPLOYEE';
  return `${candidate}@LUNA.CO.IN`;
};

const defaultUser: SessionUser = {
  name: 'Vijay Jadhav',
  employeeId: '11233',
  role: 'Admin',
  department: 'Operations',
};

const defaultAdminUsers: AdminManagedUser[] = [
  {
    id: 'seed-11233',
    employeeId: '11233',
    name: 'Vijay Jadhav',
    department: 'Operations',
    role: 'Admin',
    active: true,
    email: buildLunaEmail('11233', 'Operations', 'Vijay Jadhav'),
    phone: '+91 98765 43210',
  },
  {
    id: 'seed-2104',
    employeeId: '2104',
    name: 'Rahul Kulkarni',
    department: 'Packaging',
    role: 'Supervisor',
    active: true,
    email: buildLunaEmail('2104', 'Packaging', 'Rahul Kulkarni'),
    phone: '+91 99887 76543',
  },
];

const FAVORITES_KEY = 'luna-favorites';
const CUSTOM_MODULES_KEY = 'luna-custom-modules';
const ADMIN_USERS_KEY = 'luna-admin-users';

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [role, setRoleState] = useState<UserRole>('Admin');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customModules, setCustomModules] = useState<CustomModule[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminManagedUser[]>(defaultAdminUsers);

  useEffect(() => {
    const loadSession = async () => {
      const savedUser = await loadStoredSession();
      const storedFavorites = await AsyncStorage.getItem(FAVORITES_KEY);
      const storedModules = await AsyncStorage.getItem(CUSTOM_MODULES_KEY);
      const storedUsers = await AsyncStorage.getItem(ADMIN_USERS_KEY);

      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites) as string[]);
      }

      if (storedModules) {
        setCustomModules(JSON.parse(storedModules) as CustomModule[]);
      }

      if (storedUsers) {
        setAdminUsers(JSON.parse(storedUsers) as AdminManagedUser[]);
      }

      if (!savedUser) {
        setUser(null);
        setRoleState('Admin');
        setIsAuthenticated(false);
        return;
      }

      setUser(savedUser);
      setRoleState(savedUser.role);
      setIsAuthenticated(true);
    };

    void loadSession();
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    void AsyncStorage.setItem(CUSTOM_MODULES_KEY, JSON.stringify(customModules));
  }, [customModules]);

  useEffect(() => {
    void AsyncStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(adminUsers));
  }, [adminUsers]);

  const setRole = async (nextRole: UserRole) => {
    if (!user) {
      setRoleState(nextRole);
      return;
    }

    const nextUser = { ...user, role: nextRole };
    setUser(nextUser);
    setRoleState(nextRole);
    await persistSession(nextUser);
  };

  const login = async (employeeId: string, password: string) => {
    const result = await signIn(employeeId, password);

    if (!result.success || !result.user) {
      return { success: false, message: result.message ?? 'Unable to sign in.' };
    }

    setUser(result.user);
    setRoleState(result.user.role);
    setIsAuthenticated(true);

    return { success: true, role: result.user.role };
  };

  const logout = async () => {
    setUser(null);
    setRoleState(defaultUser.role);
    setIsAuthenticated(false);
    await clearSession();
  };

  const toggleFavorite = (key: string) => {
    setFavorites((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const isFavorite = (key: string) => favorites.includes(key);

  const refreshAdminUsers = async () => {
    try {
      const rows = await fetchAdminUsers();
      const mappedUsers: AdminManagedUser[] = rows.map((row) => ({
        id: String(row.id ?? `${row.employee_id ?? 'user'}-${Math.random()}`),
        employeeId: String(row.employee_id ?? ''),
        name: String(row.name ?? 'Unknown User'),
        department: String(row.department ?? 'Operations'),
        role: (String(row.role ?? 'User') as UserRole),
        active: Boolean(row.active),
        email: String(row.email ?? buildLunaEmail(String(row.employee_id ?? ''), String(row.department ?? 'Operations'), String(row.name ?? 'Unknown User'))),
        phone: String(row.phone ?? 'Not set'),
      }));

      setAdminUsers(mappedUsers.length > 0 ? mappedUsers : defaultAdminUsers);
    } catch (error) {
      console.warn('Failed to refresh admin users', error);
      setAdminUsers((current) => (current.length > 0 ? current : defaultAdminUsers));
    }
  };

  const addCustomModule = async (module: CustomModule) => {
    try {
      await createCustomModuleRecord(module);
    } catch (error) {
      console.warn('Custom module save failed', error);
    }

    setCustomModules((current) => [
      ...current,
      {
        ...module,
        id: module.id || `${module.type}-${Date.now()}`,
      },
    ]);
  };

  const removeCustomModule = (id: string) => {
    setCustomModules((current) => current.filter((item) => item.id !== id));
  };

  const addAdminUser = async (newUser: AdminManagedUser) => {
    const { password, ...safeUser } = newUser;
    const normalizedEmail = safeUser.email?.trim() || buildLunaEmail(safeUser.employeeId, safeUser.department, safeUser.name);

    try {
      await createAdminUser({
        employeeId: safeUser.employeeId,
        name: safeUser.name,
        password,
        role: safeUser.role,
        department: safeUser.department,
        active: safeUser.active,
        email: normalizedEmail,
      });
      await refreshAdminUsers();
    } catch (error) {
      console.warn('Admin user save failed', error);
    }

    setAdminUsers((current) => [...current, safeUser]);
  };

  const updateAdminUser = async (id: string, updates: Partial<AdminManagedUser>) => {
    const currentUser = adminUsers.find((userItem) => userItem.id === id);

    if (currentUser) {
      try {
        await updateAdminUserRemote(currentUser.employeeId, {
          name: updates.name,
          role: updates.role,
          department: updates.department,
          active: updates.active,
          password: updates.password,
        });
        await refreshAdminUsers();
      } catch (error) {
        console.warn('Admin user update failed', error);
      }
    }

    setAdminUsers((current) =>
      current.map((userItem) => (userItem.id === id ? { ...userItem, ...updates } : userItem)),
    );
  };

  const deleteAdminUser = async (id: string) => {
    const currentUser = adminUsers.find((userItem) => userItem.id === id);

    if (!currentUser) {
      return;
    }

    try {
      await deleteAdminUserRemote(currentUser.employeeId);
      await refreshAdminUsers();
    } catch (error) {
      console.warn('Admin user delete failed', error);
    }

    setAdminUsers((current) => current.filter((userItem) => userItem.id !== id));
  };

  const value = useMemo(
    () => ({
      role,
      setRole,
      user,
      isAuthenticated,
      login,
      logout,
      favorites,
      toggleFavorite,
      isFavorite,
      customModules,
      addCustomModule,
      removeCustomModule,
      adminUsers,
      refreshAdminUsers,
      addAdminUser,
      updateAdminUser,
      deleteAdminUser,
    }),
    [role, user, isAuthenticated, favorites, customModules, adminUsers],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used inside AppProvider');
  }

  return context;
}
