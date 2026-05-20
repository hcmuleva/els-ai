import { Redirect, Tabs } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Circle } from 'lucide-react-native';

import { ProfileMenu } from '../../src/components/header/ProfileMenu';
import { RoleSwitcher } from '../../src/components/header/RoleSwitcher';
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
      screenOptions={{
        headerTitle: '',
        headerLeft: () => (
          <View style={styles.brandWrapper}>
            <Image source={require('../../assets/emeelan-logo.png')} style={styles.logo} />
            <Text style={styles.brandText}>ELS</Text>
          </View>
        ),
        headerRight: () => (
          <View style={styles.headerActions}>
            <RoleSwitcher
              isOpen={openMenu === 'role'}
              onToggle={() => setOpenMenu((prev) => (prev === 'role' ? null : 'role'))}
              onClose={() => setOpenMenu(null)}
            />
            <ProfileMenu
              isOpen={openMenu === 'profile'}
              onToggle={() => setOpenMenu((prev) => (prev === 'profile' ? null : 'profile'))}
              onClose={() => setOpenMenu(null)}
            />
          </View>
        ),
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
        name="practice"
        options={{
          href: tabRoutes.has('practice') ? undefined : null,
          title: 'Practice',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('practice');
            return <Icon size={size} />;
          },
        }}
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
        name="content"
        options={{
          href: tabRoutes.has('content') ? undefined : null,
          title: 'Topic',
          tabBarIcon: ({ color, size }) => {
            const Icon = getTabIcon('content');
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  brandWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 8,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 4,
  },
  brandText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
});
