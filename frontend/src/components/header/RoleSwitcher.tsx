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
    borderWidth: 1.5,
    borderColor: '#E8EFFE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0F4FF',
  },
  triggerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4A90E2',
    letterSpacing: 0.5,
  },
  menu: {
    position: 'absolute',
    top: 42,
    right: 0,
    width: 150,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#F0F0F8',
    borderRadius: 16,
    padding: 8,
    zIndex: 20,
    shadowColor: '#4A90E2',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  roleButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    backgroundColor: '#F8F9FF',
  },
  roleButtonActive: {
    backgroundColor: '#4A90E2',
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5A5A7A',
    textAlign: 'center',
  },
  roleTextActive: {
    color: '#ffffff',
  },
});
