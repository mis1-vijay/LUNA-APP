import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
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
import SectionHeader from '../components/SectionHeader';
import ResourceCard from '../components/ResourceCard';
import Footer from '../components/Footer';
import { useAppContext } from '../context/AppContext';
import {
  type DepartmentItem,
  type PortalResource,
  type WebAppItem,
  getVisibleAdminResources,
} from '../data/portalData';
import { fetchDashboardData } from '../services/portalApi';
import { RootStackParamList, TabParamList } from '../types';

type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const stackNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { role, user, customModules, isFavorite, toggleFavorite, logout } = useAppContext();
  const [data, setData] = useState<{
    webApps: WebAppItem[];
    departments: DepartmentItem[];
    reports: PortalResource[];
    adminResources: PortalResource[];
  }>({
    webApps: [],
    departments: [],
    reports: [],
    adminResources: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const dashboard = await fetchDashboardData();
      setData({
        webApps: dashboard.webApps,
        departments: dashboard.departments,
        reports: dashboard.reports,
        adminResources: dashboard.adminResources,
      });
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

  const visibleAdminResources = useMemo(
    () =>
      getVisibleAdminResources(role)
        .filter((item) => data.adminResources.some((resource) => resource.title === item.title) || role === 'Admin' || role === 'Manager')
        .concat(
          role === 'Admin'
            ? [
                {
                  title: 'Admin Console',
                  subtitle: 'Manage users, departments and modules',
                  meta: 'Admin' as const,
                  accent: '#5e1232',
                  role: 'Admin' as const,
                  category: 'Admin' as const,
                },
              ]
            : [],
        ),
    [data.adminResources, role],
  );

  const displayedWebApps = useMemo(
    () => [
      ...data.webApps,
      ...customModules
        .filter((item) => item.type === 'webApp')
        .map((item) => ({
          title: item.title,
          subtitle: item.subtitle,
          accent: item.accent,
          access: item.access,
          url: item.link,
        })),
    ],
    [customModules, data.webApps],
  );

  const displayedDepartments = useMemo(
    () => [
      ...data.departments,
      ...customModules
        .filter((item) => item.type === 'department')
        .map((item) => ({
          name: item.title,
          tags: ['Custom', 'Department'],
          accent: item.accent,
          summary: item.subtitle,
          quickAccess: [item.link],
          metrics: [{ label: 'Link', value: 'Open' }],
          access: item.access,
        })),
    ],
    [customModules, data.departments],
  );

  const displayedReports = useMemo(
    () => [
      ...data.reports,
      ...customModules
        .filter((item) => item.type === 'report' || item.type === 'resource')
        .map((item) => ({
          title: item.title,
          subtitle: item.subtitle,
          meta: item.type === 'report' ? 'Report' : 'Form',
          accent: item.accent,
          role: item.access[0] ?? 'User',
          category: 'Report' as const,
        })),
    ],
    [customModules, data.reports],
  );

  const currentHour = new Date().getHours();
  const greetingName = user?.name?.split(' ')[0] ?? 'Vijay';
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const handleModulePress = async (label: string, link?: string) => {
    if (link && link.trim().length > 0 && /^https?:\/\//i.test(link.trim())) {
      navigation.navigate('WebAppDetail', {
        appName: label,
        appSubtitle: 'Open item in-app',
        accent: '#0284c7',
        url: link.trim(),
      });
      return;
    }

    if (label === 'Admin Console') {
      navigation.navigate('AdminConsole');
      return;
    }

    Alert.alert('Coming Soon', `${label} is ready for a destination link.`);
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
          <Text style={styles.errorText}>{error}</Text>
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
          <Text style={styles.subGreeting}>Welcome to Luna Tech Portal</Text>
        </View>

        <SectionHeader title="WEB APPS" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.webAppsScroll} contentContainerStyle={styles.webAppsRow}>
          {displayedWebApps.map((app, index) => (
            <WebAppCard
              key={`${app.title}-${index}`}
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
          ))}
        </ScrollView>

        <SectionHeader title="DEPARTMENTS" />
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

        <SectionHeader title="REPORTS & FORMS" />
        {displayedReports.map((item, index) => (
          <ResourceCard
            key={`${item.title}-${item.meta}-${index}`}
            title={item.title}
            subtitle={item.subtitle}
            meta={item.meta}
            accentColor={item.accent}
            isFavorite={isFavorite(`Report:${item.title}`)}
            onFavoritePress={() => toggleFavorite(`Report:${item.title}`)}
            onPress={() => handleModulePress(item.title, customModules.find((module) => module.title === item.title)?.link)}
          />
        ))}

        {visibleAdminResources.length > 0 ? (
          <>
            <SectionHeader title="ADMINISTRATION" />
            {visibleAdminResources.map((item, index) => (
              <ResourceCard
                key={`${item.title}-${index}`}
                title={item.title}
                subtitle={item.subtitle}
                meta={item.meta}
                accentColor={item.accent}
                isFavorite={isFavorite(`Admin:${item.title}`)}
                onFavoritePress={() => toggleFavorite(`Admin:${item.title}`)}
                onPress={() => handleModulePress(item.title, item.title === 'Admin Console' ? undefined : customModules.find((module) => module.title === item.title)?.link)}
              />
            ))}
          </>
        ) : null}

        <Footer />
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
  subGreeting: {
    color: '#475569',
    fontSize: 14,
  },
  roleLabel: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  webAppsScroll: {
    marginLeft: -4,
  },
  webAppsRow: {
    paddingRight: 18,
    paddingVertical: 2,
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
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
