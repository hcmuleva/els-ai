import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/roles';
import { Colors } from '../../theme';

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
      <Pressable
        onPress={onToggle}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel={`Switch role, currently ${user?.activeRole ?? ''}`}
      >
        <Text style={styles.triggerText}>{user?.activeRole?.toUpperCase() ?? ''}</Text>
        <ChevronDown size={14} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="none" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
        <View style={styles.menuAbsolute}>
          <View style={styles.menu}>
            {user?.roles?.map((role) => (
              <Pressable
                key={role}
                onPress={() => handleRoleChange(role)}
                style={[styles.roleButton, user?.activeRole === role && styles.roleButtonActive]}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${role} role`}
              >
                <Text style={[styles.roleText, user?.activeRole === role && styles.roleTextActive]}>
                  {role.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  menuAbsolute: {
    position: 'absolute',
    top: 56, right: 60,
    zIndex: 200,
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
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  menu: {
    width: 150,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 16,
    padding: 8,
    zIndex: 20,
    shadowColor: Colors.primary,
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
    backgroundColor: Colors.primary,
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
