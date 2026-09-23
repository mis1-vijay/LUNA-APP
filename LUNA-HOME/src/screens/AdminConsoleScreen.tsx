import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useAppContext, type AdminManagedUser, type CustomModule } from '../context/AppContext';
import { deleteModule, updateModule } from '../services/portalApi';
import type { RootStackParamList } from '../types';

const roleOptions = ['Admin', 'Manager', 'Supervisor', 'User'] as const;
const accentPalette = ['#5e1232', '#1d4ed8', '#0ea5e9', '#7c3aed', '#c2410c', '#0f766e'];

type AdminConsoleScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminConsole'>;

export default function AdminConsoleScreen({ navigation }: AdminConsoleScreenProps) {
  const { addCustomModule, addAdminUser, adminUsers, refreshAdminUsers, updateAdminUser, deleteAdminUser, role, customModules, removeCustomModule } = useAppContext();
  const [activeTab, setActiveTab] = useState<'modules' | 'users'>('modules');
  const [moduleType, setModuleType] = useState<'webApp' | 'department' | 'report' | 'resource'>('webApp');
  const [moduleName, setModuleName] = useState('');
  const [moduleSubtitle, setModuleSubtitle] = useState('');
  const [moduleLink, setModuleLink] = useState('');
  const [moduleAccent, setModuleAccent] = useState(accentPalette[0]);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [userDepartment, setUserDepartment] = useState('Packing');
  const [userRole, setUserRole] = useState<'Admin' | 'Manager' | 'Supervisor' | 'User'>('User');
  const [userPassword, setUserPassword] = useState('luna123');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const canManage = useMemo(() => role === 'Admin', [role]);
  const userSummary = useMemo(
    () => ({
      total: adminUsers.length,
      active: adminUsers.filter((person) => person.active).length,
      inactive: adminUsers.filter((person) => !person.active).length,
      departments: new Set(adminUsers.map((person) => person.department)).size,
    }),
    [adminUsers],
  );

  useEffect(() => {
    if (!canManage) {
      return;
    }

    void refreshAdminUsers();
  }, [canManage, refreshAdminUsers]);

  const handleAddModule = async () => {
    if (!moduleName.trim()) {
      Alert.alert('Missing module name', 'Please add a module name before saving.');
      return;
    }

    const newModule: CustomModule = {
      id: editingModuleId ?? `${moduleType}-${Date.now()}`,
      type: moduleType,
      title: moduleName.trim(),
      subtitle: moduleSubtitle.trim() || 'Custom portal item',
      accent: moduleAccent,
      link: moduleLink.trim() || 'https://example.com',
      access: ['Admin', 'Manager', 'Supervisor', 'User'],
      department: moduleType === 'department' ? moduleName.trim() : undefined,
    };

    setSavingModule(true);

    try {
      if (editingModuleId) {
        await updateModule(editingModuleId, {
          title: newModule.title,
          description: newModule.subtitle,
          type: newModule.type === 'webApp' ? 'webapp' : newModule.type === 'report' ? 'report' : 'form',
          url: newModule.link,
          icon: newModule.accent,
          required_role: 'User',
        });
        removeCustomModule(editingModuleId);
        addCustomModule(newModule);
        Alert.alert('Module updated', `${newModule.title} has been updated.`);
      } else {
        addCustomModule(newModule);
        Alert.alert('Module added', `${newModule.title} is now available in the portal.`);
      }

      setEditingModuleId(null);
      setModuleName('');
      setModuleSubtitle('');
      setModuleLink('');
      setModuleType('webApp');
      setModuleAccent(accentPalette[0]);
    } catch (error) {
      Alert.alert('Network error', error instanceof Error ? error.message : 'Unable to save the module.');
    } finally {
      setSavingModule(false);
    }
  };

  const beginModuleEdit = (module: CustomModule) => {
    setEditingModuleId(module.id);
    setModuleType(module.type);
    setModuleName(module.title);
    setModuleSubtitle(module.subtitle);
    setModuleLink(module.link);
    setModuleAccent(module.accent);
    setActiveTab('modules');
  };

  const handleDeleteModule = (module: CustomModule) => {
    Alert.alert('Delete module', `Remove ${module.title} from the portal?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingModuleId(module.id);

          try {
            await deleteModule(module.id);
            removeCustomModule(module.id);
            Alert.alert('Module deleted', `${module.title} was removed.`);
          } catch (error) {
            Alert.alert('Network error', error instanceof Error ? error.message : 'Unable to delete the module.');
          } finally {
            setDeletingModuleId(null);
          }
        },
      },
    ]);
  };

  const fillUserEditor = (person: AdminManagedUser) => {
    setEditingUserId(person.id);
    setUserName(person.name);
    setEmployeeId(person.employeeId);
    setUserDepartment(person.department);
    setUserRole(person.role);
    setUserPassword(person.password ?? 'luna123');
    setUserEmail(person.email);
    setUserPhone(person.phone);
    setActiveTab('users');
  };

  const handleDeleteUser = (person: AdminManagedUser) => {
    Alert.alert('Delete user', `Remove ${person.name} from the roster?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteAdminUser(person.id);
        },
      },
    ]);
  };

  const handleSaveUser = () => {
    if (!userName.trim() || !employeeId.trim()) {
      Alert.alert('User details required', 'Enter the user name and employee ID before saving.');
      return;
    }

    const generatedEmail = userEmail.trim() || `${employeeId.trim().toUpperCase()}@LUNA.CO.IN`;
    const payload: Partial<AdminManagedUser> = {
      employeeId: employeeId.trim(),
      name: userName.trim(),
      department: userDepartment.trim() || 'Operations',
      role: userRole,
      email: generatedEmail,
      phone: userPhone.trim() || 'Not set',
      password: userPassword.trim() || 'luna123',
    };

    if (editingUserId) {
      const person = adminUsers.find((item) => item.id === editingUserId);
      if (person) {
        updateAdminUser(person.id, payload);
        Alert.alert('User updated', `${payload.name} has been updated.`);
      }
    } else {
      const record: AdminManagedUser = {
        id: `user-${Date.now()}`,
        employeeId: payload.employeeId ?? employeeId.trim(),
        name: payload.name ?? userName.trim(),
        department: payload.department ?? (userDepartment.trim() || 'Operations'),
        role: payload.role ?? userRole,
        active: true,
        email: payload.email ?? `${employeeId.trim().toUpperCase()}@LUNA.CO.IN`,
        phone: payload.phone ?? (userPhone.trim() || 'Not set'),
        password: payload.password ?? (userPassword.trim() || 'luna123'),
      };

      addAdminUser(record);
      Alert.alert('User created', `${record.name} has been added as ${record.role}.`);
    }

    setEditingUserId(null);
    setUserName('');
    setEmployeeId('');
    setUserDepartment('Packing');
    setUserRole('User');
    setUserPassword('luna123');
    setUserEmail('');
    setUserPhone('');
  };

  const handleAddUser = () => {
    setEditingUserId(null);
    setUserName('');
    setEmployeeId('');
    setUserDepartment('Packing');
    setUserRole('User');
    setUserPassword('luna123');
    setUserEmail('');
    setUserPhone('');
    setActiveTab('users');
  };

  if (!canManage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.restrictedContainer}>
          <Text style={styles.title}>Access Restricted</Text>
          <Text style={styles.helperText}>Only admins can manage modules and users.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.backButtonText}>Back to portal</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.rowHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Admin console</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total users</Text>
            <Text style={styles.summaryValue}>{userSummary.total}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Active</Text>
            <Text style={styles.summaryValue}>{userSummary.active}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Departments</Text>
            <Text style={styles.summaryValue}>{userSummary.departments}</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'modules' && styles.tabButtonActive]}
            onPress={() => setActiveTab('modules')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'modules' && styles.tabTextActive]}>Modules</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'users' && styles.tabButtonActive]}
            onPress={() => setActiveTab('users')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'modules' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add module</Text>
            <TextInput
              value={moduleName}
              onChangeText={setModuleName}
              style={styles.input}
              placeholder="Module name"
              placeholderTextColor="#64748b"
            />
            <TextInput
              value={moduleSubtitle}
              onChangeText={setModuleSubtitle}
              style={styles.input}
              placeholder="Subtitle"
              placeholderTextColor="#64748b"
            />
            <TextInput
              value={moduleLink}
              onChangeText={setModuleLink}
              style={styles.input}
              placeholder="Destination link"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
            />

            <View style={styles.pillRow}>
              {(['webApp', 'department', 'report', 'resource'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => setModuleType(option)}
                  style={[styles.pill, moduleType === option && styles.pillActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, moduleType === option && styles.pillTextActive]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.colorRow}>
              {accentPalette.map((color) => (
                <TouchableOpacity
                  key={color}
                  activeOpacity={0.9}
                  onPress={() => setModuleAccent(color)}
                  style={[styles.colorDot, { backgroundColor: color, borderWidth: moduleAccent === color ? 3 : 0 }]}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => { void handleAddModule(); }} activeOpacity={0.9} disabled={savingModule}>
              {savingModule ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.primaryButtonText}>{editingModuleId ? 'Update module' : 'Add module'}</Text>}
            </TouchableOpacity>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Existing modules</Text>
              {customModules.length === 0 ? (
                <Text style={styles.emptyStateText}>No custom modules yet.</Text>
              ) : (
                customModules.map((module) => (
                  <View key={module.id} style={styles.moduleRow}>
                    <View style={styles.moduleMeta}>
                      <View style={[styles.colorDot, { backgroundColor: module.accent }]} />
                      <View style={styles.moduleInfo}>
                        <Text style={styles.moduleTitle}>{module.title}</Text>
                        <Text style={styles.moduleSubtitle}>{module.type}</Text>
                      </View>
                    </View>
                    <View style={styles.quickActions}>
                      <TouchableOpacity onPress={() => beginModuleEdit(module)} style={[styles.iconButton, styles.editButton]} activeOpacity={0.8}>
                        <Text style={styles.iconButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteModule(module)} style={[styles.iconButton, styles.deleteButton]} activeOpacity={0.8} disabled={deletingModuleId === module.id}>
                        {deletingModuleId === module.id ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.iconButtonText}>Delete</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.inlineHeader}>
                <Text style={styles.sectionTitle}>{editingUserId ? 'Update user' : 'Add user'}</Text>
                {editingUserId ? (
                  <TouchableOpacity onPress={() => handleAddUser()} activeOpacity={0.8}>
                    <Text style={styles.linkText}>New</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <TextInput
                value={userName}
                onChangeText={setUserName}
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#64748b"
              />
              <TextInput
                value={employeeId}
                onChangeText={setEmployeeId}
                style={styles.input}
                placeholder="Employee ID"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />
              <TextInput
                value={userDepartment}
                onChangeText={setUserDepartment}
                style={styles.input}
                placeholder="Department"
                placeholderTextColor="#64748b"
              />
              <TextInput
                value={userPassword}
                onChangeText={setUserPassword}
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#64748b"
                secureTextEntry
              />
              <TextInput
                value={userEmail}
                onChangeText={setUserEmail}
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />
              <TextInput
                value={userPhone}
                onChangeText={setUserPhone}
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor="#64748b"
              />

              <View style={styles.pillRow}>
                {roleOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setUserRole(option)}
                    style={[styles.pill, userRole === option && styles.pillActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.pillText, userRole === option && styles.pillTextActive]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleSaveUser} activeOpacity={0.9}>
                <Text style={styles.primaryButtonText}>{editingUserId ? 'Update user' : 'Create user'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <View style={styles.inlineHeader}>
                <Text style={styles.sectionTitle}>User roster</Text>
                <TouchableOpacity onPress={() => handleAddUser()} activeOpacity={0.8}>
                  <Text style={styles.linkText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {adminUsers.map((person) => (
                <View key={person.id} style={styles.userCard}>
                  <TouchableOpacity onPress={() => fillUserEditor(person)} activeOpacity={0.9} style={styles.userMain}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{person.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.userMeta}>
                      <Text style={styles.userName}>{person.name}</Text>
                      <Text style={styles.userRole}>{person.role}</Text>
                      <Text style={styles.userDetail}>{person.employeeId} • {person.department}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.userActions}>
                    <TouchableOpacity
                      onPress={() => updateAdminUser(person.id, { active: !person.active })}
                      style={[styles.statusPill, person.active ? styles.statusActive : styles.statusInactive]}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.statusText}>{person.active ? 'Active' : 'Inactive'}</Text>
                    </TouchableOpacity>

                    <View style={styles.quickActions}>
                      <TouchableOpacity onPress={() => fillUserEditor(person)} style={[styles.iconButton, styles.editButton]} activeOpacity={0.8}>
                        <Text style={styles.iconButtonText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteUser(person)} style={[styles.iconButton, styles.deleteButton]} activeOpacity={0.8}>
                        <Text style={styles.iconButtonText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
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
    paddingBottom: 28,
  },
  rowHeader: {
    paddingTop: 18,
    marginBottom: 8,
  },
  backLink: {
    color: '#5e1232',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 8,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '800',
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#0f172a',
  },
  inlineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    color: '#5e1232',
    fontWeight: '700',
    fontSize: 12,
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  helperText: {
    color: '#475569',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 18,
    backgroundColor: '#5e1232',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 14,
  },
  summaryLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderColor: '#0f172a',
  },
  primaryButton: {
    backgroundColor: '#5e1232',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  emptyStateText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  moduleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moduleInfo: {
    marginLeft: 12,
    flex: 1,
  },
  moduleTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
  },
  moduleSubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  userCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 10,
  },
  userMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5e1232',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  userMeta: {
    flex: 1,
    paddingRight: 8,
  },
  userRole: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  userActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  editButton: {
    backgroundColor: '#dbeafe',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  iconButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 11,
  },
  userName: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 15,
  },
  userDetail: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusInactive: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
