export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  DepartmentWorkspace: { department: string };
  WebAppDetail: {
    appName: string;
    appSubtitle: string;
    accent: string;
    url?: string;
  };
  AdminConsole: undefined;
};

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Favorites: undefined;
  Profile: undefined;
};
