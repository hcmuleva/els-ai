import { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import {
  LogOut,
  ChevronRight,
  Star,
  Flame,
  BookOpen,
  Award,  
  Lock,
  Mail,
  Bell,
  GraduationCap,
  UserRound,
  Users,
  Shield,
  Check,
  Trash2,
  Camera,
  Image as ImageIcon,
  X,
  Upload,
  type LucideIcon,
} from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../src/context/AuthContext';
import { useStudentProfile } from '../../src/context/StudentProfileContext';
import { useClassLevels } from '../../src/hooks/useClassLevels';
import { UserRole } from '../../src/types/roles';
import { RoleColors, Colors } from '../../src/theme';
import { resolveMediaUrl } from '../../src/utils/media';
import { ImageCropModal } from '../../src/components/media/ImageCropModal';
import { uploadPickedFileToS3 } from '../../src/utils/fileUpload';

const ROLE_COLORS = RoleColors;

const ROLE_ICONS: Record<string, LucideIcon> = {
  student: GraduationCap,
  teacher: UserRound,
  parent: Users,
  admin: Shield,
  superadmin: Star,
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 880;

  const {
    user,
    setActiveRole,
    signOut,
    apiFetch,
    deleteAccount,
    deleteChildAccount,
    studentSelectedClass,
    setStudentSelectedClass,
    updateProfileImage,
  } = useAuth();
  const { classLevels } = useClassLevels();
  const { linkedStudents, refreshAll } = useStudentProfile();

  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState('');
  const [photoError, setPhotoError] = useState('');

  const availableClassOptions = useMemo(() => {
    const isAll = user?.isAllStudentClasses || !user?.studentClasses || user.studentClasses.length === 0;

    if (isAll) {
      const dbOptions = classLevels
        .filter((lvl) => !lvl.isAny && lvl.value !== 'ANY')
        .map((lvl) => ({
          key: lvl.value,
          label: lvl.label,
        }));
      return [{ key: 'ANY', label: 'All Classes' }, ...dbOptions];
    }

    const assigned = user.studentClasses || [];
    const options = assigned.map((code) => {
      const match = classLevels.find((lvl) => lvl.value.toLowerCase() === code.toLowerCase());
      return {
        key: code,
        label: match ? match.label : code,
      };
    });

    if (options.length > 1) {
      return [{ key: 'ANY', label: 'All My Classes' }, ...options];
    }
    return options;
  }, [user?.isAllStudentClasses, user?.studentClasses, classLevels]);

  const [connectId, setConnectId] = useState('');
  const [connectMessage, setConnectMessage] = useState('');
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [childToRemove, setChildToRemove] = useState<any | null>(null);
  const [deleteChildLoading, setDeleteChildLoading] = useState(false);
  const [deleteChildError, setDeleteChildError] = useState('');
  const [deleteChildModalVisible, setDeleteChildModalVisible] = useState(false);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  const handleRoleSelect = (role: UserRole) => {
    setActiveRole(role);
    router.replace('/(tabs)');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';
  const roleColor = ROLE_COLORS[user?.activeRole ?? 'student'] || '#2D5DC9';
  const canConnect = user?.activeRole === 'parent' || user?.activeRole === 'student';

  const handleConnect = async () => {
    if (!connectId.trim()) {
      setConnectError('Please enter registration ID');
      return;
    }
    setConnectError('');
    setConnectMessage('');
    setConnecting(true);

    try {
      const res = await apiFetch('/api/v1/auth/connect-registration-id', {
        method: 'POST',
        body: JSON.stringify({ registrationId: connectId.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to connect. Please check the registration ID.');
      }

      setConnectMessage('Connected successfully!');
      setConnectId('');
      refreshAll();
    } catch (err: any) {
      setConnectError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleInitiateRemoveChild = (child: any) => {
    setChildToRemove(child);
    setDeleteChildError('');
    setDeleteChildModalVisible(true);
  };

  const handleDeleteAccount = () => {
    setDeleteAccountError('');
    setDeleteModalVisible(true);
  };

  const confirmDeleteAccount = async () => {
    setDeleteAccountLoading(true);
    setDeleteAccountError('');
    const res = await deleteAccount();
    setDeleteAccountLoading(false);
    if (res.success) {
      setDeleteModalVisible(false);
      router.replace('/(auth)/login');
    } else {
      setDeleteAccountError(res.error || "Failed to delete account");
    }
  };

  const confirmDeleteChildAccount = async () => {
    if (!childToRemove) return;
    setDeleteChildLoading(true);
    setDeleteChildError('');
    const regId = childToRemove.registrationId || '';
    const childId = childToRemove.id;
    const res = await deleteChildAccount(regId, childId);
    setDeleteChildLoading(false);
    if (res.success) {
      setDeleteChildModalVisible(false);
      setChildToRemove(null);
      await refreshAll();
    } else {
      setDeleteChildError(res.error || "Failed to remove child account");
    }
  };

  const profileImgUri = resolveMediaUrl(user?.profileImage);

  // Directly trigger photo picker on Web or open bottom sheet on Mobile
  const handleTriggerPhotoUpload = () => {
    setPhotoError('');
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const doc = (globalThis as any).document;
        if (!doc) return;
        const input = doc.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp,image/gif';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            setPendingImageUri(String(reader.result || ''));
            setPhotoModalVisible(false);
            setCropModalVisible(true);
          };
          reader.readAsDataURL(file);
        };
        input.click();
      }
    } else {
      setPhotoModalVisible(true);
    }
  };

  const handlePickMobileImage = async (source: 'camera' | 'library') => {
    setPhotoError('');
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      };

      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setPhotoError('Camera permission is required');
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setPhotoError('Media library permission is required');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      setPendingImageUri(dataUrl);
      setPhotoModalVisible(false);
      setCropModalVisible(true);
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to select photo');
    }
  };

  const uploadCroppedPhoto = async (dataUrl: string) => {
    try {
      setUploadingPhoto(true);
      setPhotoError('');
      const picked = {
        dataUrl,
        fileName: `avatar_${user?.id || 'profile'}_${Date.now()}.jpg`,
        mimeType: 'image/jpeg',
      };
      const uploadRes = await uploadPickedFileToS3(picked, 'image', 'profile_photo');
      const canonicalUrl = uploadRes.canonicalUrl || uploadRes.url;
      const signedUrl = uploadRes.url || canonicalUrl;
      const updateRes = await updateProfileImage(canonicalUrl, signedUrl);
      if (!updateRes.success) {
        setPhotoError(updateRes.error || 'Failed to update profile photo');
      } else {
        setPhotoModalVisible(false);
        setCropModalVisible(false);
        setPendingImageUri('');
      }
    } catch (err: any) {
      if (err.message !== 'UPLOAD_CANCELLED') {
        setPhotoError(err.message || 'Failed to upload photo');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setUploadingPhoto(true);
      setPhotoError('');
      const res = await updateProfileImage(null);
      if (!res.success) {
        setPhotoError(res.error || 'Failed to remove photo');
      } else {
        setPhotoModalVisible(false);
      }
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to remove photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ─── Sub-renderers ────────────────────────────────────────────────────────
  const renderHeroCard = () => (
    <View style={s.heroCard}>
      {/* Background soft tint */}
      <View style={[s.heroBackgroundHeader, { backgroundColor: roleColor }]} />

      {/* Avatar Container */}
      <View style={s.avatarWrapper}>
        <Pressable
          onPress={handleTriggerPhotoUpload}
          style={s.avatarPressable}
          accessibilityRole="button"
          accessibilityLabel="Upload profile photo"
        >
          <View style={[s.avatar, { backgroundColor: roleColor }]}>
            {profileImgUri ? (
              <Image source={{ uri: profileImgUri }} style={s.avatarImg} resizeMode="cover" />
            ) : (
              <Text style={s.avatarInitials}>{initials}</Text>
            )}
            {uploadingPhoto && (
              <View style={s.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
          <View style={s.cameraBadge}>
            <Camera size={14} color="#1E293B" />
          </View>
        </Pressable>
      </View>

      {/* Explicit Photo Action Buttons */}
      <View style={s.photoActionsRow}>
        <Pressable
          style={[s.uploadPhotoBtn, { backgroundColor: Colors.primary || '#2D5DC9' }]}
          onPress={handleTriggerPhotoUpload}
          disabled={uploadingPhoto}
        >
          <Camera size={14} color="#FFFFFF" />
          <Text style={s.uploadPhotoBtnText}>
            {profileImgUri ? 'Change Photo' : 'Upload Photo'}
          </Text>
        </Pressable>

        {!!profileImgUri && (
          <Pressable
            style={s.removePhotoBtn}
            onPress={handleRemovePhoto}
            disabled={uploadingPhoto}
          >
            <Trash2 size={13} color="#EF4444" />
            <Text style={s.removePhotoBtnText}>Remove</Text>
          </Pressable>
        )}
      </View>

      {!!photoError && <Text style={s.photoErrorText}>{photoError}</Text>}

      {/* User Info */}
      <Text style={s.heroName}>{user ? `${user.firstName} ${user.lastName}` : ''}</Text>
      <Text style={s.heroEmail}>{user?.email ?? ''}</Text>

      {/* Role Pill Badge */}
      <View style={[s.roleBadge, { backgroundColor: `${roleColor}14` }]}>
        {(() => {
          const RoleIcon = ROLE_ICONS[user?.activeRole ?? 'student'] ?? UserRound;
          return <RoleIcon size={14} color={roleColor} />;
        })()}
        <Text style={[s.roleBadgeText, { color: roleColor }]}>
          {user?.activeRole?.toUpperCase() ?? ''}
        </Text>
      </View>

      {/* Optional registration / student ID chip */}
      {user?.registrationId && (
        <View style={s.regIdChip}>
          <Text style={s.regIdLabel}>REG ID:</Text>
          <Text style={s.regIdValue}>{user.registrationId}</Text>
        </View>
      )}
    </View>
  );

  const renderStatsCard = () => (
    <View style={s.statsCard}>
      <Text style={s.cardHeaderTitle}>Learning Activity</Text>
      <View style={s.statsGrid}>
        {[
          { icon: <Star size={18} color="#D97706" fill="#D97706" />, val: '1,200', label: 'XP Points', bg: '#FEF3C7' },
          { icon: <Flame size={18} color="#EA580C" />, val: '7', label: 'Day Streak', bg: '#FFEDD5' },
          { icon: <BookOpen size={18} color="#2563EB" />, val: '27', label: 'Lessons', bg: '#DBEAFE' },
          { icon: <Award size={18} color="#7C3AED" />, val: '5', label: 'Badges', bg: '#EDE9FE' },
        ].map((item) => (
          <View key={item.label} style={s.statBox}>
            <View style={[s.statIconCircle, { backgroundColor: item.bg }]}>
              {item.icon}
            </View>
            <Text style={s.statVal}>{item.val}</Text>
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderRoleSwitcher = () => {
    if ((user?.roles?.length ?? 0) <= 1) return null;
    return (
      <View style={s.cardWrapper}>
        <Text style={s.cardHeaderTitle}>Switch Role</Text>
        <View style={s.cardBody}>
          {user?.roles.map((role, idx, arr) => {
            const isActive = role === user.activeRole;
            const color = ROLE_COLORS[role] ?? '#2D5DC9';
            return (
              <Pressable
                key={role}
                onPress={() => handleRoleSelect(role)}
                style={[s.roleRow, idx < arr.length - 1 && s.rowDivider]}
              >
                <View style={[s.roleIcon, { backgroundColor: `${color}16` }]}>
                  {(() => {
                    const RoleIcon = ROLE_ICONS[role] ?? UserRound;
                    return <RoleIcon size={18} color={color} />;
                  })()}
                </View>
                <View style={s.roleInfo}>
                  <Text style={s.roleName}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                  <Text style={s.roleDesc}>{isActive ? 'Currently active' : 'Tap to switch'}</Text>
                </View>
                {isActive ? (
                  <View style={[s.activeCheck, { backgroundColor: color }]}>
                    <Check size={13} color="#fff" strokeWidth={3} />
                  </View>
                ) : (
                  <ChevronRight size={16} color="#94A3B8" />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderClassSwitcher = () => {
    if (user?.activeRole !== 'student' || availableClassOptions.length <= 1) return null;
    return (
      <View style={s.cardWrapper}>
        <Text style={s.cardHeaderTitle}>Select Class</Text>
        <View style={s.cardBody}>
          {availableClassOptions.map((opt, idx, arr) => {
            const isSelected = (!studentSelectedClass && opt.key === 'ANY') || studentSelectedClass === opt.key;
            const color = Colors.primary;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setStudentSelectedClass(opt.key)}
                style={[s.roleRow, idx < arr.length - 1 && s.rowDivider]}
              >
                <View style={[s.roleIcon, { backgroundColor: '#EEF2FF' }]}>
                  <GraduationCap size={18} color={color} />
                </View>
                <View style={s.roleInfo}>
                  <Text style={s.roleName}>{opt.label}</Text>
                  <Text style={s.roleDesc}>{isSelected ? 'Active class view' : 'Tap to switch'}</Text>
                </View>
                {isSelected ? (
                  <View style={[s.activeCheck, { backgroundColor: color }]}>
                    <Check size={13} color="#fff" strokeWidth={3} />
                  </View>
                ) : (
                  <ChevronRight size={16} color="#94A3B8" />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderConnectCard = () => {
    if (!canConnect) return null;
    const isParentRole = user?.activeRole === 'parent';

    return (
      <View style={s.cardWrapper}>
        <Text style={s.cardHeaderTitle}>Family Connections</Text>
        <View style={s.cardBody}>
          {/* Linked Children List for Parents */}
          {isParentRole && (
            <>
              <View style={s.linkedChildrenContainer}>
                <View style={s.linkedChildrenHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.linkedChildrenTitle}>Linked Children</Text>
                    <View style={s.childCountPill}>
                      <Text style={s.childCountPillText}>{linkedStudents.length}</Text>
                    </View>
                  </View>
                </View>

                {linkedStudents.length === 0 ? (
                  <View style={s.noChildrenBox}>
                    <Text style={s.noChildrenText}>No children linked yet. Connect a child below using their Registration ID.</Text>
                  </View>
                ) : (
                  <View style={s.childList}>
                    {linkedStudents.map((child, idx) => {
                      const avatarUri = resolveMediaUrl(child.profileImage);
                      const childIdDisplay = child.registrationId || (child.id ? `ID: ${child.id.slice(0, 8)}...` : 'Unknown ID');
                      return (
                        <View key={child.id || idx} style={s.childRow}>
                          <View style={s.childAvatarBox}>
                            {avatarUri ? (
                              <Image source={{ uri: avatarUri }} style={s.childAvatarImg} />
                            ) : (
                              <Text style={s.childAvatarInitials}>
                                {child.firstName?.charAt(0) || 'S'}
                              </Text>
                            )}
                          </View>
                          <View style={s.childInfo}>
                            <Text style={s.childNameText} numberOfLines={1}>
                              {child.firstName} {child.lastName || ''}
                            </Text>
                            <View style={s.childMetaRow}>
                              {child.classLevel && (
                                <View style={s.childClassBadge}>
                                  <Text style={s.childClassBadgeText}>Class {child.classLevel}</Text>
                                </View>
                              )}
                              <View style={s.childIdBadge}>
                                <Text style={s.childIdBadgeText}>{childIdDisplay}</Text>
                              </View>
                            </View>
                          </View>
                          <Pressable
                            style={s.removeChildBtn}
                            onPress={() => handleInitiateRemoveChild(child)}
                          >
                            <Trash2 size={13} color="#DC2626" />
                            <Text style={s.removeChildBtnText}>Remove</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
              <View style={s.divider} />
            </>
          )}

          <View style={s.connectInner}>
            <Text style={s.connectTitle}>
              {isParentRole ? 'Add Another Child by Registration ID' : 'Add Parent by Registration ID'}
            </Text>
            <Text style={s.connectSubtitle}>
              Link family members to view academic progress, assignments, and test reports.
            </Text>
            <View style={s.connectInputRow}>
              <TextInput
                value={connectId}
                onChangeText={setConnectId}
                autoCapitalize="characters"
                placeholder="ELS-XXXXXXXXXX"
                placeholderTextColor="#94A3B8"
                style={s.connectInput}
              />
              <Pressable
                style={[s.connectBtn, connecting && s.btnDisabled]}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.connectBtnText}>Connect</Text>
                )}
              </Pressable>
            </View>
            {!!connectMessage && <Text style={s.connectSuccess}>{connectMessage}</Text>}
            {!!connectError && <Text style={s.connectError}>{connectError}</Text>}
          </View>
        </View>
      </View>
    );
  };

  const renderParentDangerCard = () => null;

  const renderAccountCard = () => (
    <View style={s.cardWrapper}>
      <Text style={s.cardHeaderTitle}>Account & Security</Text>
      <View style={s.cardBody}>
        {[
          { Icon: Lock, label: 'Change Password', sub: 'Update security password', color: '#2563EB', onPress: () => router.push('/(tabs)/settings') },
          { Icon: Mail, label: 'Update Email', sub: user?.email ?? '', color: '#16A34A' },
          { Icon: Bell, label: 'Notifications', sub: 'Manage push & in-app alerts', color: '#D97706', onPress: () => router.push('/(tabs)/settings') },
        ].map((item, idx, arr) => (
          <Pressable
            key={item.label}
            style={[s.menuRow, idx < arr.length - 1 && s.rowDivider]}
            onPress={item.onPress}
          >
            <View style={[s.menuIconBox, { backgroundColor: `${item.color}14` }]}>
              <item.Icon size={18} color={item.color} />
            </View>
            <View style={s.menuInfo}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuSub} numberOfLines={1}>{item.sub}</Text>
            </View>
            <ChevronRight size={16} color="#94A3B8" />
          </Pressable>
        ))}
      </View>
    </View>
  );

  const renderSignOutButton = () => (
    <Pressable style={s.logOutBtn} onPress={() => signOut()}>
      <LogOut size={17} color="#2563EB" />
      <Text style={s.logOutText}>Log Out</Text>
    </Pressable>
  );

  const renderDeleteAccountCard = () => (
    <Pressable style={s.deleteAccountBtn} onPress={handleDeleteAccount}>
      <Trash2 size={16} color="#EF4444" />
      <Text style={s.deleteAccountText}>Delete Account</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[
        s.scroll,
        {
          paddingBottom: Math.max(120, insets.bottom + 80),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {isDesktop ? (
        <View style={s.desktopContainer}>
          {/* Left Column (360px Sidebar) */}
          <View style={s.desktopSidebar}>
            {renderHeroCard()}
            {renderStatsCard()}
            {renderRoleSwitcher()}
            {renderSignOutButton()}
          </View>

          {/* Right Column (Main content) */}
          <View style={s.desktopMainContent}>
            {renderClassSwitcher()}
            {renderConnectCard()}
            {renderParentDangerCard()}
            {renderAccountCard()}
            {renderDeleteAccountCard()}
          </View>
        </View>
      ) : (
        <View style={s.mobileContainer}>
          {renderHeroCard()}
          {renderStatsCard()}
          {renderRoleSwitcher()}
          {renderClassSwitcher()}
          {renderConnectCard()}
          {renderParentDangerCard()}
          {renderAccountCard()}
          {renderSignOutButton()}
          {renderDeleteAccountCard()}
        </View>
      )}

      {/* ─── Delete Account Modal ────────────────────────────────────── */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Delete Account</Text>
            <Text style={s.modalText}>
              Are you sure you want to delete your account?{'\n\n'}
              This will permanently delete your profile, progress, scores, and all associated data. This action cannot be undone.
            </Text>
            {!!deleteAccountError && <Text style={s.connectError}>{deleteAccountError}</Text>}
            <View style={s.modalActions}>
              <Pressable style={s.modalBtnCancel} onPress={() => setDeleteModalVisible(false)}>
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.modalBtnDelete} onPress={confirmDeleteAccount} disabled={deleteAccountLoading}>
                {deleteAccountLoading ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" /> : <Text style={s.modalBtnDeleteText}>Delete</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Delete Child Modal ──────────────────────────────────────── */}
      <Modal
        visible={deleteChildModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteChildModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Remove Child Account</Text>
            <Text style={s.modalText}>
              Are you sure you want to remove{' '}
              <Text style={{ fontWeight: '800', color: Colors.text }}>
                {childToRemove ? `${childToRemove.firstName} ${childToRemove.lastName || ''}`.trim() : 'this child'}
              </Text>
              {childToRemove?.registrationId ? ` (${childToRemove.registrationId})` : ''} from your linked accounts?{'\n\n'}
              This will unlink and remove this child from your parent dashboard.
            </Text>
            {!!deleteChildError && <Text style={s.connectError}>{deleteChildError}</Text>}
            <View style={s.modalActions}>
              <Pressable style={s.modalBtnCancel} onPress={() => { setDeleteChildModalVisible(false); setChildToRemove(null); }}>
                <Text style={s.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.modalBtnDelete} onPress={confirmDeleteChildAccount} disabled={deleteChildLoading}>
                {deleteChildLoading ? <ActivityIndicator accessibilityLabel="Loading" color="#fff" /> : <Text style={s.modalBtnDeleteText}>Remove Child</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Mobile Photo Options Sheet ──────────────────────────────── */}
      <Modal
        visible={photoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setPhotoModalVisible(false)}>
          <Pressable style={s.photoSheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={s.photoSheetHeader}>
              <Text style={s.modalTitle}>Profile Photo</Text>
              <Pressable
                onPress={() => setPhotoModalVisible(false)}
                style={s.photoSheetCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={18} color="#64748B" />
              </Pressable>
            </View>

            {!!photoError && <Text style={s.connectError}>{photoError}</Text>}

            <View style={s.photoOptionsList}>
              <Pressable
                style={s.photoOptionRow}
                onPress={() => handlePickMobileImage('camera')}
                accessibilityRole="button"
              >
                <View style={[s.photoOptionIconBox, { backgroundColor: '#EEF2FF' }]}>
                  <Camera size={20} color="#4F46E5" />
                </View>
                <View style={s.photoOptionTextCol}>
                  <Text style={s.photoOptionTitle}>Take Photo</Text>
                  <Text style={s.photoOptionSubtitle}>Use camera to capture a new picture</Text>
                </View>
              </Pressable>

              <Pressable
                style={s.photoOptionRow}
                onPress={() => handlePickMobileImage('library')}
                accessibilityRole="button"
              >
                <View style={[s.photoOptionIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <ImageIcon size={20} color="#16A34A" />
                </View>
                <View style={s.photoOptionTextCol}>
                  <Text style={s.photoOptionTitle}>Choose from Gallery</Text>
                  <Text style={s.photoOptionSubtitle}>Select an existing image from device</Text>
                </View>
              </Pressable>

              {!!profileImgUri && (
                <Pressable
                  style={[s.photoOptionRow, s.photoOptionRowDanger]}
                  onPress={handleRemovePhoto}
                  accessibilityRole="button"
                >
                  <View style={[s.photoOptionIconBox, { backgroundColor: '#FEE2E2' }]}>
                    <Trash2 size={20} color="#DC2626" />
                  </View>
                  <View style={s.photoOptionTextCol}>
                    <Text style={[s.photoOptionTitle, { color: '#DC2626' }]}>Remove Photo</Text>
                    <Text style={s.photoOptionSubtitle}>Revert to initials avatar</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Interactive Image Crop Modal (Desktop & Mobile) ─────────── */}
      <ImageCropModal
        visible={cropModalVisible}
        imageUri={pendingImageUri}
        onClose={() => {
          setCropModalVisible(false);
          setPendingImageUri('');
        }}
        onCropComplete={(croppedDataUrl) => {
          uploadCroppedPhoto(croppedDataUrl);
        }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    paddingTop: 16,
  },

  // Responsive Layout Containers
  desktopContainer: {
    maxWidth: 1140,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 24,
    paddingHorizontal: 24,
    alignItems: 'flex-start',
  },
  desktopSidebar: {
    width: 360,
    flexShrink: 0,
    gap: 20,
  },
  desktopMainContent: {
    flex: 1,
    gap: 20,
  },
  mobileContainer: {
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    gap: 18,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  heroBackgroundHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    opacity: 0.12,
  },
  avatarWrapper: {
    marginTop: 12,
    marginBottom: 12,
    position: 'relative',
  },
  avatarPressable: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  // Dedicated Photo Buttons
  photoActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  uploadPhotoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  removePhotoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  photoErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },

  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
    textAlign: 'center',
  },
  heroEmail: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 10,
    textAlign: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  regIdChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  regIdLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  regIdValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Stats Card
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 18,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // Generic Card Wrapper
  cardWrapper: {
    gap: 8,
  },
  cardHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  cardBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    overflow: 'hidden',
  },

  // Row list items
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  activeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Menu Rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  menuSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },

  // Connect Section
  connectInner: {
    padding: 16,
    gap: 10,
  },
  connectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  connectSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  connectInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  connectInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  connectBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteChildBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteChildBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  connectSuccess: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '600',
  },
  connectError: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

  // Sign out / Account Actions
  logOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  logOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteAccountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalBtnCancel: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  modalBtnCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalBtnDelete: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#EF4444',
  },
  modalBtnDeleteText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Photo Sheet Modal (Mobile)
  photoSheetContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    padding: 22,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  photoSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptionsList: {
    gap: 10,
  },
  photoOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  photoOptionRowDanger: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
  },
  photoOptionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOptionTextCol: {
    flex: 1,
  },
  photoOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoOptionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  linkedChildrenContainer: {
    padding: 16,
    paddingBottom: 4,
  },
  linkedChildrenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  linkedChildrenTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  childCountPill: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  childCountPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  noChildrenBox: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    alignItems: 'center',
    marginBottom: 12,
  },
  noChildrenText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  childList: {
    gap: 10,
    marginBottom: 12,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  childRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8ECF4',
  },
  childAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  childAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  childAvatarInitials: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
  },
  childInfo: {
    flex: 1,
    gap: 4,
  },
  childNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  childMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  childClassBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  childClassBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  childIdBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  childIdBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  removeChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  removeChildBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8ECF4',
    marginHorizontal: 16,
  },
});
