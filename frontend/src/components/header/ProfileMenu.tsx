import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LogOut, Settings, User } from 'lucide-react-native';

import { profileMenuItems } from '../../config/roleTabs';
import { useAuth } from '../../context/AuthContext';

type ProfileMenuProps = {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
};

const ROLE_COLORS: Record<string, string> = {
  student:    '#4A90E2',
  teacher:    '#FF7043',
  parent:     '#7DC67A',
  admin:      '#9B8EC4',
  superadmin: '#E6A817',
};

export function ProfileMenu({ isOpen, onToggle, onClose }: ProfileMenuProps) {
  const { user, signOut } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';
  const avatarBg = ROLE_COLORS[user?.activeRole ?? 'student'] ?? '#4A90E2';

  return (
    <View style={styles.wrapper}>
      {/* Invisible backdrop to close on outside tap */}
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.menuAbsolute}>
          <View style={styles.menu}>
          {/* User card */}
          <View style={[styles.userCard, { borderLeftColor: avatarBg }]}>
            <View style={[styles.avatarSm, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarSmText}>{initials}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user ? `${user.firstName} ${user.lastName}` : ''}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
            </View>
          </View>

          {/* Role badge */}
          <View style={[styles.roleBadge, { backgroundColor: `${avatarBg}18` }]}>
            <Text style={[styles.roleText, { color: avatarBg }]}>
              {user?.activeRole?.toUpperCase() ?? ''}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Menu items */}
          {profileMenuItems.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => { router.push(`/(tabs)/${item.route}`); onClose(); }}
              style={styles.menuItem}
            >
              <View style={styles.menuIconWrap}>
                {item.label === 'Settings'
                  ? <Settings size={15} color="#7A7A9A" />
                  : <User size={15} color="#7A7A9A" />}
              </View>
              <Text style={styles.menuItemText}>{item.label}</Text>
            </Pressable>
          ))}

          <View style={styles.divider} />

          {/* Logout */}
          <Pressable
            onPress={async () => { onClose(); await signOut(); }}
            style={styles.menuItem}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: '#FFE8E8' }]}>
              <LogOut size={15} color="#FF4444" />
            </View>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
          </View>
        </View>
      </Modal>

      {/* Avatar trigger */}
      <Pressable onPress={onToggle} style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },

  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },

  menuAbsolute: {
    position: 'absolute',
    top: 56, right: 12,
    zIndex: 200,
  },

  avatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '900', color: '#fff' },

  menu: {
    width: 230,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0F0F8',
    padding: 12,
    shadowColor: '#4A90E2',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    gap: 4,
  },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F8F9FF',
    borderRadius: 14, padding: 10,
    borderLeftWidth: 3,
    marginBottom: 4,
  },
  avatarSm: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  userInfo:   { flex: 1 },
  userName:   { fontSize: 13, fontWeight: '800', color: '#1a1a2e' },
  userEmail:  { fontSize: 11, fontWeight: '500', color: '#9A9AB0', marginTop: 1 },

  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 4,
  },
  roleText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  divider: { height: 1, backgroundColor: '#F0F0F8', marginVertical: 4 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6,
  },
  menuIconWrap: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: '#F0F0F8',
    alignItems: 'center', justifyContent: 'center',
  },
  menuItemText: { fontSize: 13, fontWeight: '600', color: '#1a1a2e' },
  logoutText:   { fontSize: 13, fontWeight: '700', color: '#FF4444' },
});
