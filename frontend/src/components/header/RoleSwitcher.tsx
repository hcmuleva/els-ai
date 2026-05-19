import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/roles';

type RoleSwitcherProps = {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function RoleSwitcher({ isOpen, onToggle, onClose }: RoleSwitcherProps) {
  const { user, setActiveRole } = useAuth();

  const handleRoleChange = (role: UserRole) => {
    setActiveRole(role);
    router.replace('/(tabs)');
    onClose();
  };

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={onToggle} style={styles.trigger}>
        <Text style={styles.triggerText}>{user?.activeRole.toUpperCase() || ''}</Text>
        <ChevronDown size={14} />
      </Pressable>

      {isOpen ? (
        <View style={styles.menu}>
          {user?.roles.map((role) => (
            <Pressable
              key={role}
              onPress={() => handleRoleChange(role)}
              style={[styles.roleButton, user.activeRole === role && styles.roleButtonActive]}
            >
              <Text style={[styles.roleText, user.activeRole === role && styles.roleTextActive]}>
                {role.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  trigger: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  triggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  menu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 140,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    zIndex: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  roleButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 6,
  },
  roleButtonActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  roleTextActive: {
    color: '#ffffff',
  },
});
