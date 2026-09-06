import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LogOut, Settings, User } from 'lucide-react-native';

import { profileMenuItems } from '../../config/roleTabs';
import { useAuth } from '../../context/AuthContext';
import { Colors, RoleColors } from '../../theme';

type ProfileMenuProps = {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
};

// The role badge below renders its text in the role color directly on a
// ~9%-alpha tint of that same color. `Colors.accent`/`RoleColors.superadmin`
// only clear WCAG AA (4.5:1) against solid white with a thin margin (4.68 /
// 5.06), so on this tint they dropped to 4.09 / 4.48. These two get a
// slightly darker stand-in just for this small-text badge; the other three
// roles keep enough margin on the tint already.
const BADGE_TEXT_COLORS: Record<string, string> = {
  teacher: '#B03A19',
  superadmin: '#6B4E08',
};

export function ProfileMenu({ isOpen, onToggle, onClose }: ProfileMenuProps) {
  const { user, signOut } = useAuth();

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';
  const avatarBg = RoleColors[user?.activeRole ?? 'student'] ?? Colors.primary;
  const badgeTextColor = BADGE_TEXT_COLORS[user?.activeRole ?? ''] ?? avatarBg;

  return (
    <View style={styles.wrapper}>
      {/* Invisible backdrop to close on outside tap */}
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
        <View style={styles.menuAbsolute}>
          <View style={styles.menu}>
          {/* User card */}
          <Pressable
            onPress={() => { router.push('/(tabs)/profile'); onClose(); }}
            style={styles.userCard}
            accessibilityRole="button"
            accessibilityLabel="View profile"
          >
            <View style={[styles.avatarSm, { backgroundColor: avatarBg }]}>
              <Text style={styles.avatarSmText}>{initials}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user ? `${user.firstName} ${user.lastName}` : ''}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email ?? ''}</Text>
              {!!user?.registrationId && (
                <Text style={styles.userRegId} numberOfLines={1}>ID: {user.registrationId}</Text>
              )}
            </View>
          </Pressable>

          {/* Role badge */}
          <View style={[styles.roleBadge, { backgroundColor: `${avatarBg}18` }]}>
            <Text style={[styles.roleText, { color: badgeTextColor }]}>
              {user?.activeRole?.toUpperCase() ?? ''}
            </Text>
          </View>

          {/* Menu items */}
          {profileMenuItems.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => { router.push(`/(tabs)/${item.route}`); onClose(); }}
              style={styles.menuItem}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.menuIconWrap}>
                {item.label === 'Settings'
                  ? <Settings size={15} color="#7A7A9A" />
                  : <User size={15} color="#7A7A9A" />}
              </View>
              <Text style={styles.menuItemText}>{item.label}</Text>
            </Pressable>
          ))}

          {/* Logout */}
          <Pressable
            onPress={async () => { onClose(); await signOut(); }}
            style={styles.menuItem}
            accessibilityRole="button"
            accessibilityLabel="Log out"
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
      <Pressable
        onPress={onToggle}
        style={[styles.avatar, { backgroundColor: avatarBg }]}
        accessibilityRole="button"
        accessibilityLabel="Open profile menu"
      >
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
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
    shadowColor: Colors.primary,
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
    marginBottom: 8,
  },
  avatarSm: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmText: { fontSize: 13, fontWeight: '900', color: '#fff' },
  userInfo:   { flex: 1 },
  userName:   { fontSize: 13, fontWeight: '800', color: Colors.text },
  userEmail:  { fontSize: 11, fontWeight: '500', color: Colors.textMuted, marginTop: 1 },
  userRegId:  { fontSize: 10, fontWeight: '700', color: Colors.primary, marginTop: 2 },

  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 4,
  },
  roleText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7,
  },
  menuIconWrap: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  menuItemText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  // Darkened from #FF4444 (3.41:1 on white) to clear WCAG AA.
  logoutText:   { fontSize: 13, fontWeight: '700', color: '#B71C1C' },
});
