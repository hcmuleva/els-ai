import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { ScreenTemplate } from '../../src/components/ScreenTemplate';
import { useAuth } from '../../src/context/AuthContext';
import { UserRole } from '../../src/types/roles';

export default function ProfileScreen() {
  const { user, setActiveRole } = useAuth();

  const handleRoleSelect = (role: UserRole) => {
    setActiveRole(role);
    router.replace('/(tabs)');
  };

  return (
    <ScreenTemplate title="Profile">
      <View style={styles.userCard}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <Text style={styles.label}>Select Profile Role</Text>
      <View style={styles.rolesContainer}>
        {user.roles.map((role) => (
          <Pressable
            key={role}
            onPress={() => handleRoleSelect(role)}
            style={[styles.roleButton, user.activeRole === role && styles.roleButtonActive]}
          >
            <Text style={[styles.roleText, user.activeRole === role && styles.roleTextActive]}>
              {role.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScreenTemplate>
  );
}

const styles = StyleSheet.create({
  userCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 12,
    marginBottom: 14,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  email: {
    marginTop: 2,
    fontSize: 13,
    color: '#475569',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  rolesContainer: {
    gap: 10,
  },
  roleButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  roleButtonActive: {
    borderColor: '#1d4ed8',
    backgroundColor: '#1d4ed8',
  },
  roleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  roleTextActive: {
    color: '#ffffff',
  },
});
