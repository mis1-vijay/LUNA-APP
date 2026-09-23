import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
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
import { useAppContext, type CustomModule } from '../context/AppContext';
import { RootStackParamList } from '../types';

type DepartmentWorkspaceScreenProps = NativeStackScreenProps<RootStackParamList, 'DepartmentWorkspace'>;

export default function DepartmentWorkspaceScreen({ route, navigation }: DepartmentWorkspaceScreenProps) {
  const { department } = route.params;
  const { addCustomModule, customModules } = useAppContext();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newType, setNewType] = useState<'webApp' | 'report' | 'resource'>('resource');

  const departmentModules = useMemo(
    () =>
      customModules.filter(
        (module) =>
          module.department === department ||
          (module.type !== 'department' &&
            (module.title.toLowerCase().includes(department.toLowerCase()) ||
              module.department?.toLowerCase().includes(department.toLowerCase()))),
      ),
    [customModules, department],
  );

  const handleAddResource = () => {
    if (!newTitle.trim()) {
      Alert.alert('Missing title', 'Enter a resource name before saving.');
      return;
    }

    const newModule: CustomModule = {
      id: `${newType}-${Date.now()}`,
      type: newType,
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || 'Custom resource',
      accent: '#0284c7',
      link: newLink.trim() || 'https://example.com',
      access: ['Admin', 'Manager', 'Supervisor', 'User'],
      department,
    };

    addCustomModule(newModule);
    setIsAddOpen(false);
    setNewTitle('');
    setNewSubtitle('');
    setNewLink('');
    setNewType('resource');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsAddOpen(true)} activeOpacity={0.8} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
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
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  if (item.link && /^https?:\/\//i.test(item.link)) {
                    navigation.navigate('WebAppDetail', {
                      appName: item.title,
                      appSubtitle: item.subtitle,
                      accent: item.accent,
                      url: item.link,
                    });
                  }
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
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No resources added yet. Tap + Add to create your first item for this department.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={isAddOpen} animationType="slide" onRequestClose={() => setIsAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add resource</Text>

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

            <View style={styles.pillRow}>
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
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setIsAddOpen(false)} style={[styles.modalButton, styles.secondaryButton]}>
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
