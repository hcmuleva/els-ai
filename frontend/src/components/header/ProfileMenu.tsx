import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CircleUserRound, LogOut } from 'lucide-react-native';

import { profileMenuItems } from '../../config/roleTabs';
import { useAuth } from '../../context/AuthContext';

type ProfileMenuProps = {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function ProfileMenu({ isOpen, onToggle, onClose }: ProfileMenuProps) {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={onToggle} style={styles.iconButton}>
        <CircleUserRound size={24} />
      </Pressable>

      {isOpen ? (
        <View style={styles.menu}>
          <View style={styles.userCard}>
            <Text style={styles.userName}>{user ? `${user.firstName} ${user.lastName}` : ''}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
          </View>

          {profileMenuItems.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                router.push(`/(tabs)/${item.route}`);
                onClose();
              }}
              style={styles.menuItem}
            >
              <item.icon size={16} />
              <Text style={styles.menuItemText}>{item.label}</Text>
            </Pressable>
          ))}

          <Pressable
            onPress={async () => {
              onClose();
              await signOut();
            }}
            style={[styles.menuItem, styles.logoutItem]}
          >
            <LogOut size={16} color="#dc2626" />
            <Text style={[styles.menuItemText, styles.logoutText]}>Log Out</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  iconButton: {
    padding: 8,
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: 40,
    width: 220,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 10,
  },
  userCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  menuItemText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  logoutItem: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 6,
    paddingTop: 8,
  },
  logoutText: {
    color: '#dc2626',
  },
});
