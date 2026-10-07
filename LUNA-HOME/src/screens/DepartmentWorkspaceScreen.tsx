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
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { useAppContext, type CustomModule } from '../context/AppContext';
import {
  deleteResourceRecord,
  fetchDepartmentResources,
  type DashboardDepartmentResource,
  updateResourceRecord,
} from '../services/portalApi';
import { RootStackParamList } from '../types';

type DepartmentWorkspaceScreenProps = NativeStackScreenProps<RootStackParamList, 'DepartmentWorkspace'>;

const ROLE_RANK: Record<string, number> = { user: 1, supervisor: 2, manager: 3, admin: 4 };
const getRoleRank = (role: string) => ROLE_RANK[role.trim().toLowerCase()] ?? 0;
const getRequiredRole = (access: string[]) =>
  (['User', 'Supervisor', 'Manager', 'Admin'] as const).find((accessLevel) => access.includes(accessLevel)) ?? 'User';
const isBackendResourceId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const canManageResource = (role: string, access: string[]) => {
  if (
    role.trim().toLowerCase() === 'manager' &&
    access.some((requiredRole) => requiredRole.trim().toLowerCase() === 'admin')
  ) {
    return false;
  }

  return access.length > 0 &&
    getRoleRank(role) >=
      access.reduce((highestRank, requiredRole) => Math.max(highestRank, ROLE_RANK[requiredRole.trim().toLowerCase()] ?? Infinity), 0);
};
const canViewResource = (role: string, access: string[]) =>
  access.some((requiredRole) => getRoleRank(role) >= (ROLE_RANK[requiredRole.trim().toLowerCase()] ?? Infinity)) ||
  (role.trim().toLowerCase() === 'manager' && access.some((requiredRole) => requiredRole.trim().toLowerCase() === 'admin'));

export default function DepartmentWorkspaceScreen({ route, navigation }: DepartmentWorkspaceScreenProps) {
  const { department } = route.params;
  const { addCustomModule, removeCustomModule, customModules, role } = useAppContext();
  const canManageResources = role === 'Admin';
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [apiDepartmentResources, setApiDepartmentResources] = useState<DashboardDepartmentResource[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newType, setNewType] = useState<'webApp' | 'report' | 'resource'>('resource');
  const [newAccessLevel, setNewAccessLevel] = useState('User');
  const [editingResource, setEditingResource] = useState<CustomModule | null>(null);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setLoadError(null);
    fetchDepartmentResources(department)
      .then((resources) => {
        if (isCurrent) {
          setApiDepartmentResources(resources);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setLoadError(error instanceof Error ? error.message : 'Unable to load department resources.');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [department, reloadKey]);

  const departmentModules = useMemo(
    () =>
      [
        ...customModules.filter(
          (module) =>
            module.title.trim().toLowerCase() !== 'user access matrix' &&
            (module.department === department ||
              (module.type !== 'department' &&
                (module.title.toLowerCase().includes(department.toLowerCase()) ||
                  module.department?.toLowerCase().includes(department.toLowerCase())))),
        ),
        ...apiDepartmentResources.map((resource): CustomModule => ({
          ...resource,
          type: resource.type,
        })),
      ].filter((module) => canViewResource(role, module.access)),
    [apiDepartmentResources, customModules, department, role],
  );

  const handleAddResource = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Missing title', 'Enter a resource name before saving.');
      return;
    }

    if (!newLink.trim()) {
      Alert.alert('Destination link required', 'Enter a valid URL/link before saving this resource.');
      return;
    }

    try {
      if (editingResource) {
        if (isBackendResourceId(editingResource.id)) {
          const type =
            editingResource.type === 'webApp'
              ? 'webapp'
              : editingResource.type === 'resource'
                ? 'module'
                : editingResource.type;
          await updateResourceRecord(editingResource.id, {
            title: newTitle.trim(),
            description: newSubtitle.trim() || 'Custom resource',
            type,
            url: newLink.trim(),
            required_role: newAccessLevel,
          });
          await removeCustomModule(editingResource.id);
          setReloadKey((current) => current + 1);
        } else {
          await addCustomModule({
            ...editingResource,
            title: newTitle.trim(),
            subtitle: newSubtitle.trim() || 'Custom resource',
            link: newLink.trim(),
            access: [newAccessLevel],
          });
        }
        setIsAddOpen(false);
        setEditingResource(null);
        setNewTitle('');
        setNewSubtitle('');
        setNewLink('');
        return;
      }

      const newModule: CustomModule = {
        id: `${newType}-${Date.now()}`,
        type: newType,
        title: newTitle.trim(),
        subtitle: newSubtitle.trim() || 'Custom resource',
        accent: '#0284c7',
        link: newLink.trim() || 'https://example.com',
        access: [newAccessLevel],
        department,
      };

      await addCustomModule(newModule);
      setIsAddOpen(false);
      setNewTitle('');
      setNewSubtitle('');
      setNewLink('');
      setNewType('resource');
      setNewAccessLevel('User');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'The department workspace could not be saved.');
    }
  };

  const openEditResource = (resource: CustomModule) => {
    setEditingResource(resource);
    setNewTitle(resource.title);
    setNewSubtitle(resource.subtitle);
    setNewLink(resource.link);
    setNewType(resource.type === 'webApp' ? 'webApp' : resource.type === 'report' ? 'report' : 'resource');
    setNewAccessLevel(getRequiredRole(resource.access));
    setIsAddOpen(true);
  };

  const closeResourceModal = () => {
    setIsAddOpen(false);
    setEditingResource(null);
    setNewTitle('');
    setNewSubtitle('');
    setNewLink('');
  };

  const handleDeleteResource = (resource: CustomModule) => {
    Alert.alert('Delete resource', `Remove ${resource.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isBackendResourceId(resource.id)) {
              await deleteResourceRecord(resource.id);
              await removeCustomModule(resource.id);
              setReloadKey((current) => current + 1);
            } else {
              await removeCustomModule(resource.id);
            }
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete this resource.');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#5e1232" />
          <Text style={styles.loadingText}>Loading department resources…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.centeredState}>
          <ErrorState title="Unable to load department" message={loadError} />
          <TouchableOpacity style={styles.retryButton} onPress={() => setReloadKey((current) => current + 1)} activeOpacity={0.9}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {canManageResources ? (
            <TouchableOpacity
              onPress={() => {
                setEditingResource(null);
                setNewTitle('');
                setNewSubtitle('');
                setNewLink('');
                setNewType('resource');
                setNewAccessLevel('User');
                setIsAddOpen(true);
              }}
              activeOpacity={0.8}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.title}>{department}</Text>

        {departmentModules.length > 0 ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Custom items</Text>
              <Text style={styles.summaryValue}>{departmentModules.length}</Text>
            </View>

            <View style={styles.grid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Linked</Text>
                <Text style={styles.metricValue}>{departmentModules.filter((item) => item.link).length}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Ready</Text>
                <Text style={styles.metricValue}>Live</Text>
              </View>
            </View>
          </>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Department modules</Text>
          {departmentModules.length > 0 ? (
            departmentModules.map((item) => (
              <View key={`${item.id}-${item.title}`}>
                <TouchableOpacity
                  onPress={() => {
                    if (item.link) {
                      navigation.navigate('WebAppDetail', {
                        appName: item.title,
                        appSubtitle: item.subtitle ?? 'Department resource',
                        accent: '#0284c7',
                        url: item.link,
                      });
                      return;
                    }

                    Alert.alert('Unable to open resource', 'This department item does not have a destination URL yet.');
                  }}
                  activeOpacity={0.8}
                  style={styles.rowItem}
                >
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowText}>{item.title}</Text>
                    <Text style={styles.rowSubText}>{item.subtitle}</Text>
                  </View>
                  <Text style={styles.rowChevron}>{'>'}</Text>
                </TouchableOpacity>
                {Boolean(item.id) && canManageResource(role, item.access) ? (
                  <View style={styles.resourceActions}>
                    <TouchableOpacity onPress={() => openEditResource(item)} style={styles.resourceActionButton}>
                      <Text style={styles.resourceActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteResource(item)} style={[styles.resourceActionButton, styles.deleteActionButton]}>
                      <Text style={styles.resourceActionText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <EmptyState
              title="No resources yet"
              message="Tap + Add to create your first item for this department."
            />
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={isAddOpen} animationType="slide" onRequestClose={() => setIsAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingResource ? 'Edit resource' : 'Add resource'}</Text>

            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              style={styles.input}
              placeholder="Resource name"
              placeholderTextColor="#64748b"
            />
            <TextInput
              value={newSubtitle}
              onChangeText={setNewSubtitle}
              style={styles.input}
              placeholder="Short description"
              placeholderTextColor="#64748b"
            />
            <TextInput
              value={newLink}
              onChangeText={setNewLink}
              style={styles.input}
              placeholder="https://example.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />

            <Text style={styles.accessLabel}>Viewing level</Text>
            <View style={styles.pillRow}>
              {(['User', 'Supervisor', 'Manager', 'Admin'] as const)
                .filter((accessLevel) => getRoleRank(role) >= ROLE_RANK[accessLevel.toLowerCase()])
                .map((accessLevel) => (
                  <TouchableOpacity
                    key={accessLevel}
                    onPress={() => setNewAccessLevel(accessLevel)}
                    style={[styles.pill, newAccessLevel === accessLevel && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, newAccessLevel === accessLevel && styles.pillTextActive]}>{accessLevel}</Text>
                  </TouchableOpacity>
                ))}
            </View>

            {!editingResource ? <View style={styles.pillRow}>
              {(['resource', 'report', 'webApp'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setNewType(option)}
                  style={[styles.pill, newType === option && styles.pillActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, newType === option && styles.pillTextActive]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeResourceModal} style={[styles.modalButton, styles.secondaryButton]}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddResource} style={[styles.modalButton, styles.primaryButton]}>
                <Text style={styles.primaryButtonText}>Save</Text>
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
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: '#5e1232',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  addButton: {
    backgroundColor: '#5e1232',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  backText: {
    color: '#5e1232',
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 18,
    marginBottom: 18,
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 8,
  },
  metricValue: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  rowText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  rowChevron: {
    color: '#64748b',
    fontSize: 20,
  },
  resourceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingBottom: 8,
  },
  resourceActionButton: {
    minWidth: 62,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#5e1232',
  },
  deleteActionButton: {
    backgroundColor: '#b91c1c',
  },
  resourceActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 14,
  },
  emptyStateText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: '#0f172a',
    fontSize: 14,
  },
  accessLabel: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  pillActive: {
    backgroundColor: '#e0ecff',
    borderColor: '#93c5fd',
  },
  pillText: {
    color: '#475569',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#5e1232',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
