import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  clearSession,
  loadStoredSession,
  signIn,
  type SessionUser,
  type UserRole,
} from '../services/authService';
import {
  createAdminUser,
  deleteAdminUser as deleteAdminUserRemote,
  fetchAdminUsers,
  fetchWorkspaceSettings,
  registerPushToken,
  saveWorkspaceSettings,
  unregisterPushTokens,
  updateAdminUser as updateAdminUserRemote,
} from '../services/portalApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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

export type CustomModule = {
  id: string;
  type: 'webApp' | 'department' | 'report' | 'resource' | 'webapp' | 'form' | 'module' | 'tiny';
  title: string;
  subtitle: string;
  accent: string;
  link: string;
  access: string[];
  department?: string;
};

type AppContextValue = {
  role: UserRole;
  user: SessionUser | null;
  isAuthenticated: boolean;
  login: (employeeId: string, password: string) => Promise<{ success: boolean; message?: string; role?: UserRole }>;
  logout: () => Promise<void>;
  favorites: string[];
  toggleFavorite: (key: string) => Promise<void>;
  isFavorite: (key: string) => boolean;
  adminUsers: AdminManagedUser[];
  refreshAdminUsers: () => Promise<void>;
  addAdminUser: (newUser: AdminManagedUser) => Promise<void>;
  updateAdminUser: (id: string, updates: Partial<AdminManagedUser>) => Promise<void>;
  deleteAdminUser: (id: string) => Promise<void>;
  customModules: CustomModule[];
  addCustomModule: (module: CustomModule) => Promise<void>;
  removeCustomModule: (moduleId: string) => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [role, setRoleState] = useState<UserRole>('User');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminManagedUser[]>([]);
  const [customModules, setCustomModules] = useState<CustomModule[]>([]);
  const [hasLoadedWorkspace, setHasLoadedWorkspace] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      const savedUser = await loadStoredSession();

      if (!savedUser) {
        setUser(null);
        setRoleState('User');
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
    if (!isAuthenticated || !user) {
      setFavorites([]);
      setCustomModules([]);
      setHasLoadedWorkspace(false);
      return;
    }

    const loadWorkspace = async () => {
      try {
        const workspace = await fetchWorkspaceSettings();
        setFavorites(Array.isArray(workspace.favorites) ? workspace.favorites : []);
        setCustomModules(Array.isArray(workspace.workspace_layout) ? (workspace.workspace_layout as CustomModule[]) : []);
        setHasLoadedWorkspace(true);
      } catch (error) {
        console.warn('Failed to load workspace settings', error);
        setFavorites([]);
        setCustomModules([]);
      }
    };

    void loadWorkspace();
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || !hasLoadedWorkspace) {
      return;
    }

    const persistWorkspace = async () => {
      try {
        await saveWorkspaceSettings(favorites, customModules as Array<Record<string, unknown>>);
      } catch (error) {
        console.warn('Failed to persist workspace settings', error);
      }
    };

    void persistWorkspace();
  }, [favorites, customModules, isAuthenticated, hasLoadedWorkspace, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || Platform.OS === 'web') {
      return;
    }

    let active = true;
    const registerDevice = async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('portal-updates', {
            name: 'Portal updates',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) {
          permission = await Notifications.requestPermissionsAsync();
        }
        if (!permission.granted) {
          return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          throw new Error('Expo push notifications require an EAS project ID.');
        }

        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        if (active) {
          await registerPushToken(token.data);
        }
      } catch (error) {
        console.warn('Failed to register Expo push notifications', error);
      }
    };

    void registerDevice();

    return () => {
      active = false;
    };
  }, [isAuthenticated, user]);

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
    if (isAuthenticated) {
      try {
        await unregisterPushTokens();
      } catch (error) {
        console.warn('Failed to unregister Expo push notifications during logout', error);
      }
    }
    setUser(null);
    setRoleState('User');
    setIsAuthenticated(false);
    await clearSession();
  };

  const toggleFavorite = async (key: string) => {
    const nextFavorites = favorites.includes(key)
      ? favorites.filter((item) => item !== key)
      : [...favorites, key];

    setFavorites(nextFavorites);

    if (!isAuthenticated || !user) {
      return;
    }

    try {
      await saveWorkspaceSettings(nextFavorites, customModules as Array<Record<string, unknown>>);
    } catch (error) {
      console.warn('Failed to persist favorites to backend', error);
      setFavorites(favorites);
    }
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
        email: String(row.email ?? ''),
        phone: String(row.phone ?? 'Not set'),
      }));

      setAdminUsers(mappedUsers);
    } catch (error) {
      setAdminUsers([]);
      throw error;
    }
  };

  const addAdminUser = async (newUser: AdminManagedUser) => {
    const { password, ...safeUser } = newUser;
    if (!password || password.trim().length < 8) {
      throw new Error('An initial password of at least 8 characters is required.');
    }
    await createAdminUser({ ...safeUser, password: password.trim(), email: safeUser.email.trim() });
    await refreshAdminUsers();
  };

  const updateAdminUser = async (id: string, updates: Partial<AdminManagedUser>) => {
    const currentUser = adminUsers.find((userItem) => userItem.id === id);

    if (currentUser) {
      await updateAdminUserRemote(currentUser.employeeId, {
        name: updates.name,
        role: updates.role,
        department: updates.department,
        active: updates.active,
        password: updates.password,
        email: updates.email,
        phone: updates.phone,
      });
      await refreshAdminUsers();
    }
  };

  const deleteAdminUser = async (id: string) => {
    const currentUser = adminUsers.find((userItem) => userItem.id === id);

    if (!currentUser) {
      return;
    }

    await deleteAdminUserRemote(currentUser.employeeId);
    await refreshAdminUsers();
  };

  const addCustomModule = async (module: CustomModule) => {
    setCustomModules((current) => {
      const existingIndex = current.findIndex((item) => item.id === module.id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = module;
        return next;
      }
      return [...current, module];
    });
  };

  const removeCustomModule = async (moduleId: string) => {
    setCustomModules((current) => current.filter((item) => item.id !== moduleId));
  };

  const value = useMemo(
    () => ({
      role,
      user,
      isAuthenticated,
      login,
      logout,
      favorites,
      toggleFavorite,
      isFavorite,
      adminUsers,
      refreshAdminUsers,
      addAdminUser,
      updateAdminUser,
      deleteAdminUser,
      customModules,
      addCustomModule,
      removeCustomModule,
    }),
    [role, user, isAuthenticated, favorites, adminUsers, customModules],
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
