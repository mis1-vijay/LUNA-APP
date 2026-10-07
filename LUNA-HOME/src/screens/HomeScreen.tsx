import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type CompositeScreenProps } from '@react-navigation/native';
import { type BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { type NativeStackNavigationProp, type NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../components/Header';
import WebAppCard from '../components/WebAppCard';
import DepartmentCard from '../components/DepartmentCard';
import ResourceCard from '../components/ResourceCard';
import Footer from '../components/Footer';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useAppContext } from '../context/AppContext';
import {
  type DepartmentItem,
  type PortalResource,
  type WebAppItem,
} from '../data/portalData';
import {
  createResourceRecord,
  deleteResourceRecord,
  fetchDashboardData,
  updateResourceRecord,
} from '../services/portalApi';
import { RootStackParamList, TabParamList } from '../types';

type ResourceCategory = 'webapp' | 'report' | 'form' | 'admin';
type PortalRoleLevel = 'User' | 'Supervisor' | 'Manager' | 'Admin';
type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

type ResourceFormState = {
  id?: string;
  title: string;
  description: string;
  url: string;
  requiredRole: PortalRoleLevel;
  category: ResourceCategory;
};

const ROLE_RANK: Record<string, number> = { user: 1, employee: 1, supervisor: 2, manager: 3, admin: 4 };
const ROLE_OPTIONS: PortalRoleLevel[] = ['User', 'Supervisor', 'Manager', 'Admin'];

const getRequiredRole = (access: string[]) =>
  ROLE_OPTIONS.find((candidate) => access.some((roleName) => roleName.trim().toLowerCase() === candidate.toLowerCase())) ?? 'User';

const canAccessRole = (currentRole: string | undefined, requiredRole?: string) => {
  const currentRoleName = currentRole?.trim().toLowerCase() ?? 'user';
  if (currentRoleName === 'admin') {
    return true;
  }

  const target = requiredRole?.trim().toLowerCase() || 'user';
  const current = ROLE_RANK[currentRoleName] ?? 0;
  const needed = ROLE_RANK[target] ?? 0;
  return current > 0 && needed > 0 && current >= needed;
};

const canViewRole = (currentRole: string | undefined, requiredRole?: string) =>
  canAccessRole(currentRole, requiredRole) ||
  (currentRole?.trim().toLowerCase() === 'manager' && requiredRole?.trim().toLowerCase() === 'admin');

const canManageResource = (currentRole: string | undefined, requiredRole?: string | string[]) =>
  (Array.isArray(requiredRole)
    ? requiredRole.some((accessRole) => canAccessRole(currentRole, accessRole))
    : canAccessRole(currentRole, requiredRole));

const isBackendResourceId = (id?: string): id is string =>
  typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const normalizeLink = (value?: string) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { role, user, customModules, isFavorite, toggleFavorite, logout, addCustomModule, removeCustomModule } = useAppContext();
  const [dynamicWebApps, setDynamicWebApps] = useState<WebAppItem[]>([]);
  const [dynamicDepartments, setDynamicDepartments] = useState<DepartmentItem[]>([]);
  const [dynamicReports, setDynamicReports] = useState<PortalResource[]>([]);
  const [dynamicAdminResources, setDynamicAdminResources] = useState<PortalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resourceModalVisible, setResourceModalVisible] = useState(false);
  const [resourceForm, setResourceForm] = useState<ResourceFormState>({
    title: '',
    description: '',
    url: '',
    requiredRole: 'User',
    category: 'webapp',
  });
  const [savingResource, setSavingResource] = useState(false);

  const isAdmin = role === 'Admin';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dashboard = await fetchDashboardData();
      setDynamicWebApps(dashboard.webApps);
      setDynamicDepartments(dashboard.departments);
      setDynamicReports(dashboard.reports);
      setDynamicAdminResources(dashboard.adminResources);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load dashboard data.';
      setError(message);

      if (/expired|unauthorized|invalid token|401|403/i.test(message)) {
        await logout();
        stackNavigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }

      Alert.alert('Dashboard Error', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const visibleWebApps = useMemo(
    () =>
      [...dynamicWebApps, ...customModules.filter((item) => item.type === 'webApp' && item.title.trim().toLowerCase() !== 'user access matrix').map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        accent: item.accent,
        access: item.access,
        url: item.link,
      }))].filter((item) => item.access.some((accessRole) => canViewRole(role, accessRole))),
    [customModules, dynamicWebApps, role],
  );

  const displayedDepartments = useMemo(
    () =>
      [...dynamicDepartments, ...customModules.filter((item) => item.type === 'department' && item.title.trim().toLowerCase() !== 'user access matrix').map((item) => ({
        name: item.title,
        tags: ['Custom', 'Department'],
        accent: item.accent,
        summary: item.subtitle,
        metrics: [{ label: 'Link', value: 'Open' }],
        access: item.access,
      }))].filter((item) => item.access?.some((accessRole) => canAccessRole(role, accessRole)) ?? true),
    [customModules, dynamicDepartments, role],
  );

  const visibleReports = useMemo(
    () =>
      [...dynamicReports, ...customModules.filter((item) => (item.type === 'report' || item.type === 'resource') && item.title.trim().toLowerCase() !== 'user access matrix').map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        meta: item.type === 'report' ? 'Report' : 'Form',
        accent: item.accent,
        role: getRequiredRole(item.access),
        category: 'Report' as const,
        url: item.link,
      }))].filter((item) => {
        const isSystemAudit = item.title.trim().toLowerCase() === 'system audit';
        return (!isSystemAudit || isAdmin) && canViewRole(role, item.role ?? 'User');
      }),
    [customModules, dynamicReports, isAdmin, role],
  );

  const visibleAdminResources = useMemo(
    () =>
      [
        ...dynamicAdminResources,
        ...(role === 'Admin' || role === 'Manager' ? [{ title: 'Admin Console', subtitle: 'View users and portal modules', meta: 'Admin' as const, accent: '#5e1232', role: 'Admin', category: 'Admin' as const }] : []),
      ].filter((item) =>
        (item.title === 'Admin Console' && role === 'Manager') || canViewRole(role, item.role ?? 'Admin'),
      ),
    [dynamicAdminResources, isAdmin, role],
  );

  const currentHour = new Date().getHours();
  const greetingName = user?.name?.split(' ')[0] ?? 'Vijay';
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const handleModulePress = async (label: string, link?: string) => {
    if (label === 'Admin Console') {
      if (role === 'Admin' || role === 'Manager') {
        navigation.navigate('AdminConsole');
      }
      return;
    }

    if (link && link.trim().length > 0) {
      navigation.navigate('WebAppDetail', {
        appName: label,
        appSubtitle: 'Portal resource',
        accent: '#5e1232',
        url: link.trim(),
      });
    }
  };

  const openCreateResource = (category: ResourceCategory) => {
    setResourceForm({
      title: '',
      description: '',
      url: '',
      requiredRole: category === 'admin' ? 'Admin' : 'User',
      category,
    });
    setResourceModalVisible(true);
  };

  const openEditResource = (category: ResourceCategory, resource: { id?: string | number; title: string; subtitle?: string; url?: string; role?: string }) => {
    const resourceId = resource.id == null ? undefined : String(resource.id);
    setResourceForm({
      id: resourceId,
      title: resource.title,
      description: resource.subtitle ?? '',
      url: resource.url ?? '',
      requiredRole: (resource.role as PortalRoleLevel) ?? 'User',
      category,
    });
    setResourceModalVisible(true);
  };

  const handleResourceDelete = async (category: ResourceCategory, resource: { id?: string; title: string }) => {
    if (!resource.id) {
      Alert.alert('Delete unavailable', 'This item does not have a server record yet.');
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resource.id);
    const legacyModule = customModules.find((module) => module.id === resource.id);
    if (!isUuid && legacyModule) {
      await removeCustomModule(resource.id);
      return;
    }

    Alert.alert('Delete resource', `Remove ${resource.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteResourceRecord(resource.id!);
            await removeCustomModule(resource.id!);
            await loadData();
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete the resource.');
          }
        },
      },
    ]);
  };

  const handleSaveResource = async () => {
    if (!resourceForm.title.trim()) {
      Alert.alert('Missing title', 'Add a title before saving this resource.');
      return;
    }

    if (!resourceForm.url.trim()) {
      Alert.alert('Missing destination', 'Add a valid URL for the portal item.');
      return;
    }

    const normalizedUrl = normalizeLink(resourceForm.url);
    setSavingResource(true);

    try {
      const payload = {
        title: resourceForm.title.trim(),
        description: resourceForm.description.trim() || 'Portal resource',
        type: resourceForm.category,
        category: resourceForm.category,
        url: normalizedUrl,
        link: normalizedUrl,
        required_role: resourceForm.requiredRole,
      };

      const resourceId = resourceForm.id;
      if (isBackendResourceId(resourceId)) {
        await updateResourceRecord(resourceId, payload);
        await removeCustomModule(resourceId);
      } else if (resourceId) {
        const localModule = customModules.find((module) => module.id === resourceId);
        if (!localModule) {
          throw new Error('This resource is no longer available. Refresh the list and retry.');
        }
        await addCustomModule({
          ...localModule,
          title: payload.title,
          subtitle: payload.description,
          link: normalizedUrl,
          access: [resourceForm.requiredRole],
        });
      } else {
        await createResourceRecord(payload);
      }

      setResourceModalVisible(false);
      setResourceForm({ title: '', description: '', url: '', requiredRole: 'User', category: 'webapp' });
      await loadData();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to save the resource.');
    } finally {
      setSavingResource(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.stateText}>Loading portal data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.centeredState}>
          <ErrorState title="Connection issue" message={error} />
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadData()} activeOpacity={0.9}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.greetingCard}>
          <Text style={styles.greeting}>{greeting}, {greetingName}</Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTitleWrap}>
            <Text style={styles.sectionHeaderText}>WEB APPS</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.addButton} onPress={() => openCreateResource('webapp')} activeOpacity={0.8}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
        {visibleWebApps.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.webAppsScroll} contentContainerStyle={styles.webAppsRow}>
            {visibleWebApps.map((app, index) => (
              <View key={`${app.title}-${index}`} style={styles.resourceStack}>
                <WebAppCard
                  title={app.title}
                  subtitle={app.subtitle}
                  accentColor={app.accent}
                  isFavorite={isFavorite(`Web App:${app.title}`)}
                  onFavoritePress={() => toggleFavorite(`Web App:${app.title}`)}
                  onPress={() => {
                    const customWebApp = customModules.find((module) => module.title === app.title && module.type === 'webApp');
                    if (customWebApp && customWebApp.link) {
                      void handleModulePress(app.title, customWebApp.link);
                      return;
                    }

                    navigation.navigate('WebAppDetail', {
                      appName: app.title,
                      appSubtitle: app.subtitle,
                      accent: app.accent,
                      url: app.url,
                    });
                  }}
                />
                {canManageResource(role, app.access) && app.id ? (
                  <View style={styles.adminActionRow}>
                    <TouchableOpacity style={styles.adminActionButton} onPress={() => openEditResource('webapp', app)}>
                      <Text style={styles.adminActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.adminActionButton, styles.deleteButton]} onPress={() => handleResourceDelete('webapp', app)}>
                      <Text style={styles.adminActionText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : (
          <EmptyState title="No web apps yet" message="There are no portal apps available right now." />
        )}

        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTitleWrap}>
            <Text style={styles.sectionHeaderText}>DEPARTMENTS</Text>
          </View>
        </View>
        {displayedDepartments.length > 0 ? (
          <View style={styles.departmentGrid}>
            {displayedDepartments.map((department, index) => (
              <DepartmentCard
                key={`${department.name}-${index}`}
                name={department.name}
                tags={department.tags}
                accentColor={department.accent}
                isFavorite={isFavorite(`Department:${department.name}`)}
                onFavoritePress={() => toggleFavorite(`Department:${department.name}`)}
                onPress={() => navigation.navigate('DepartmentWorkspace', { department: department.name })}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No departments" message="Department workspaces will appear here when they are available." />
        )}

        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderTitleWrap}>
            <Text style={styles.sectionHeaderText}>REPORTS & FORMS</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.addButton} onPress={() => openCreateResource('report')} activeOpacity={0.8}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
        {visibleReports.length > 0 ? (
          visibleReports.map((item, index) => (
            <View key={`${item.title}-${item.meta}-${index}`} style={styles.resourceStack}>
              <ResourceCard
                title={item.title}
                subtitle={item.subtitle}
                meta={item.meta}
                accentColor={item.accent}
                isFavorite={isFavorite(`Report:${item.title}`)}
                onFavoritePress={() => toggleFavorite(`Report:${item.title}`)}
                onPress={() => {
                  if (item.title.trim().toLowerCase() === 'system audit') {
                    if (isAdmin) {
                      navigation.navigate('SystemAudit');
                    }
                    return;
                  }

                  void handleModulePress(item.title, item.url);
                }}
              />
              {'id' in item && canManageResource(role, item.role) && item.id ? (
                <View style={styles.adminActionRow}>
                  <TouchableOpacity style={styles.adminActionButton} onPress={() => openEditResource('report', item)}>
                    <Text style={styles.adminActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.adminActionButton, styles.deleteButton]} onPress={() => handleResourceDelete('report', item)}>
                    <Text style={styles.adminActionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <EmptyState title="No reports or forms" message="This department does not have any content available yet." />
        )}

        {visibleAdminResources.length > 0 ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderTitleWrap}>
                <Text style={styles.sectionHeaderText}>ADMINISTRATION</Text>
              </View>
              {isAdmin && (
                <TouchableOpacity style={styles.addButton} onPress={() => openCreateResource('admin')} activeOpacity={0.8}>
                  <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
              )}
            </View>
            {visibleAdminResources.map((item, index) => (
              <View key={`${item.title}-${index}`} style={styles.resourceStack}>
                <ResourceCard
                  title={item.title}
                  subtitle={item.subtitle}
                  meta={item.meta}
                  accentColor={item.accent}
                  isFavorite={isFavorite(`Admin:${item.title}`)}
                  onFavoritePress={() => toggleFavorite(`Admin:${item.title}`)}
                  onPress={() => handleModulePress(item.title, item.title === 'Admin Console' ? undefined : ('url' in item ? item.url : undefined))}
                />
                {'id' in item && canManageResource(role, item.role) && item.id ? (
                  <View style={styles.adminActionRow}>
                    <TouchableOpacity style={styles.adminActionButton} onPress={() => openEditResource('admin', item)}>
                      <Text style={styles.adminActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.adminActionButton, styles.deleteButton]} onPress={() => handleResourceDelete('admin', item)}>
                      <Text style={styles.adminActionText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </>
        ) : (
          <View style={styles.adminEmptyState}>
            <EmptyState title="No admin tools" message="No delegated admin actions are available for your current role." />
          </View>
        )}

        <Footer />
      </ScrollView>

      <Modal visible={resourceModalVisible} transparent animationType="fade" onRequestClose={() => setResourceModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{resourceForm.id ? 'Edit resource' : 'Add resource'}</Text>
            <TextInput
              value={resourceForm.title}
              onChangeText={(value) => setResourceForm((current) => ({ ...current, title: value }))}
              placeholder="Title"
              style={styles.input}
            />
            <TextInput
              value={resourceForm.description}
              onChangeText={(value) => setResourceForm((current) => ({ ...current, description: value }))}
              placeholder="Description"
              style={styles.input}
              multiline
            />
            <TextInput
              value={resourceForm.url}
              onChangeText={(value) => setResourceForm((current) => ({ ...current, url: value }))}
              placeholder="URL"
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.roleLabelHeader}>Viewing level</Text>
            <View style={styles.rolePickerRow}>
              {ROLE_OPTIONS.filter((option) => canAccessRole(role, option)).map((option) => (
                <TouchableOpacity
                  key={option}
                  activeOpacity={0.8}
                  style={[styles.roleButton, resourceForm.requiredRole === option && styles.roleButtonSelected]}
                  onPress={() => setResourceForm((current) => ({ ...current, requiredRole: option }))}
                >
                  <Text style={[styles.roleButtonText, resourceForm.requiredRole === option && styles.roleButtonTextSelected]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setResourceModalVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSaveResource()} disabled={savingResource}>
                <Text style={styles.primaryButtonText}>{savingResource ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  greetingCard: {
    paddingVertical: 18,
    paddingHorizontal: 4,
  },
  greeting: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 22,
  },
  sectionHeaderTitleWrap: {
    flex: 1,
  },
  sectionHeaderText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },
  webAppsScroll: {
    marginLeft: -4,
  },
  webAppsRow: {
    paddingRight: 18,
    paddingVertical: 2,
  },
  resourceStack: {
    marginBottom: 10,
  },
  adminActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  adminActionButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  adminActionText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 11,
  },
  adminEmptyState: {
    marginTop: 12,
  },
  departmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stateText: {
    color: '#475569',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#5e1232',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    color: '#0f172a',
  },
  roleLabelHeader: {
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 8,
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  roleButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  roleButtonSelected: {
    backgroundColor: '#5e1232',
    borderColor: '#5e1232',
  },
  roleButtonText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  roleButtonTextSelected: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  primaryButton: {
    backgroundColor: '#5e1232',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginLeft: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
});
