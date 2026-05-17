import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

type ScreenTemplateProps = PropsWithChildren<{
  title: string;
}>;

export function ScreenTemplate({ title, children }: ScreenTemplateProps) {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Active Role: {user.activeRole.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 16,
  },
});
