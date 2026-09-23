import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import DepartmentWorkspaceScreen from './src/screens/DepartmentWorkspaceScreen';
import WebAppDetailScreen from './src/screens/WebAppDetailScreen';
import AdminConsoleScreen from './src/screens/AdminConsoleScreen';
import { AppProvider } from './src/context/AppContext';
import { RootStackParamList, TabParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function HomeTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#5e1232',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ color, size }) => {
          const iconNameMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Search: 'search-outline',
            Favorites: 'star-outline',
            Profile: 'person-outline',
          };

          return <Ionicons name={iconNameMap[route.name] ?? 'home-outline'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top']}>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Login"
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="MainTabs" component={HomeTabs} />
              <Stack.Screen name="DepartmentWorkspace" component={DepartmentWorkspaceScreen} />
              <Stack.Screen name="WebAppDetail" component={WebAppDetailScreen} />
              <Stack.Screen name="AdminConsole" component={AdminConsoleScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaView>
      </SafeAreaProvider>
    </AppProvider>
  );
}
