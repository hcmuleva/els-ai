import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Circle } from 'lucide-react-native';

import { NotificationBell } from '../../src/components/header/NotificationBell';
import { ProfileMenu } from '../../src/components/header/ProfileMenu';
import { RoleSwitcher } from '../../src/components/header/RoleSwitcher';
import CustomTabBar from '../../src/components/nav/CustomTabBar';
import { roleTabs } from '../../src/config/roleTabs';
import { useAuth } from '../../src/context/AuthContext';

export default function TabsLayout() {
  const { isAuthenticated, user } = useAuth();
  const [openMenu, setOpenMenu] = useState<'role' | 'profile' | null>(null);
  const activeTabs = roleTabs[user?.activeRole || 'student'];
  const tabRoutes = new Set(activeTabs.map((item) => item.route));

  const getTabIcon = (route: string) => {
    const found = activeTabs.find((item) => item.route === route);
    return found?.icon ?? Circle;
  };

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerTitle: '',
        headerStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#F0F0F8',
        } as any,
        headerShadowVisible: false,
        headerLeft: () => (
          <View style={styles.brandWrapper}>
            <Image source={require('../../assets/emeelan-logo.png')} style={styles.logo} />
            <View style={styles.brandTextRow}>
              <Text style={styles.brandEls}>ELS</Text>
              <Text style={styles.brandDot}>·</Text>
              <Text style={styles.brandAi}>AI</Text>
            </View>
          </View>
        ),
        headerRight: () => (
          <View style={styles.headerActions}>
            <RoleSwitcher
              isOpen={openMenu === 'role'}
              onToggle={() => setOpenMenu((prev) => (prev === 'role' ? null : 'role'))}
              onClose={() => setOpenMenu(null)}
            />
            <NotificationBell />
            <ProfileMenu
              isOpen={openMenu === 'profile'}
              onToggle={() => setOpenMenu((prev) => (prev === 'profile' ? null : 'profile'))}
              onClose={() => setOpenMenu(null)}
            />
          </View>
        ),
        animation: 'fade',
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: tabRoutes.has('index') ? undefined : null,
          title: 'Home',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('index');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="classroom"
        options={{
          href: tabRoutes.has('classroom') ? undefined : null,
          title: 'Classroom',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('classroom');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{ href: null, title: 'Practice' }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          href: tabRoutes.has('planner') ? undefined : null,
          title: 'Class Planner',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('planner');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="exam"
        options={{
          href: tabRoutes.has('exam') ? undefined : null,
          title: 'Exam Setup',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('exam');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="logicopiccolo"
        options={{
          href: tabRoutes.has('logicopiccolo') ? undefined : null,
          title: 'Logicopiccolo',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('logicopiccolo');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="assessment"
        options={{
          href: tabRoutes.has('assessment') ? undefined : null,
          title: 'Assessment',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('assessment');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="evaluation"
        options={{
          href: tabRoutes.has('evaluation') ? undefined : null,
          title: 'Evaluation',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('evaluation');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: tabRoutes.has('reports') ? undefined : null,
          title: 'Reports',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('reports');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="manage"
        options={{
          href: tabRoutes.has('manage') ? undefined : null,
          title: 'Manage',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('manage');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: tabRoutes.has('admin') ? undefined : null,
          title: 'Admin',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('admin');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="superadmin"
        options={{
          href: tabRoutes.has('superadmin') ? undefined : null,
          title: 'Superadmin',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('superadmin');
            return <Icon size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profile',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: 'Settings',
        }}
      />
      <Tabs.Screen
        name="subject"
        options={{
          href: null,
          title: 'Subjects',
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 12,
  },
  brandWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  brandEls: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4A90E2',
    letterSpacing: 0.5,
  },
  brandDot: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF7043',
  },
  brandAi: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF7043',
    letterSpacing: 0.5,
  },
});
