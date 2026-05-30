import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  ArrowRight, Building2, Check, ChevronDown, CreditCard, Image as ImageIcon, Layers, Mail, Pencil,
  Search, ShieldCheck, Trash2, UploadCloud, UserPlus, Users, X,
} from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { Colors, Radius, Shadow } from '../../src/theme';
import { BillingPanel } from '../../src/components/billing/BillingPanel';
import { PlansPanel } from '../../src/components/billing/PlansPanel';
import SelectorModal, { SelectorOption } from '../../src/components/SelectorModal';
import { pickFileAsDataUrl } from '../../src/components/quiz/questionEditor.helpers';
import { STANDARD_OPTIONS, getStandardLabel } from '../../src/constants/standards';

type Organization = {
  id: string;
  name: string;
  subdomain: string;
  logo?: string | null;
  logoUrl?: string | null;
  isDefault?: boolean;
};

type OrganizationUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  activeRole: string;
  roles: string[];
  canPublishGlobal?: boolean;
};

type SuperadminTab = 'org' | 'billing' | 'plans';

const TABS: Array<{ key: SuperadminTab; label: string; icon: any; description: string }> = [
  { key: 'org',     label: 'Organizations', icon: Building2,  description: 'Manage tenants & members' },
  { key: 'billing', label: 'Billing',       icon: CreditCard, description: 'Invoices & payment history' },
  { key: 'plans',   label: 'Plans',         icon: Layers,     description: 'Plan catalog & assignment' },
];

const CREATABLE_ROLES = ['student', 'teacher', 'parent', 'admin', 'superadmin'] as const;
type CreatableRole = (typeof CREATABLE_ROLES)[number];

export default function SuperadminPage() {
  const { user, apiFetch } = useAuth();
  const isSuperadmin = user?.activeRole === 'superadmin' || user?.roles?.includes('superadmin');

  const [activeTab, setActiveTab] = useState<SuperadminTab>('org');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [orgUsers, setOrgUsers] = useState<OrganizationUser[]>([]);

  const [orgPickerOpen, setOrgPickerOpen] = useState(false);

  // Create-org card state
  const [orgName, setOrgName] = useState('');
  const [orgSubdomain, setOrgSubdomain] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [orgLogoUploading, setOrgLogoUploading] = useState(false);

  // Edit-org modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSubdomain, setEditSubdomain] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editLogoUploading, setEditLogoUploading] = useState(false);
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Add-user modal state
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [userFirstName, setUserFirstName] = useState('');
  const [userLastName, setUserLastName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userMobile, setUserMobile] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<CreatableRole>('student');
  const [userClassLevel, setUserClassLevel] = useState('');
  const [userBranch, setUserBranch] = useState('');
  const [userSaving, setUserSaving] = useState(false);
  const [standardPickerOpen, setStandardPickerOpen] = useState(false);

  // Assign-user modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignResults, setAssignResults] = useState<OrganizationUser[]>([]);
  const [assignSearching, setAssignSearching] = useState(false);
  const [assignSelectedUser, setAssignSelectedUser] = useState<OrganizationUser | null>(null);
  const [assignTargetOrgId, setAssignTargetOrgId] = useState('');
  const [assignTargetPickerOpen, setAssignTargetPickerOpen] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);

  const selectedOrg = useMemo(
    () => organizations.find((item) => item.id === selectedOrgId) || null,
    [organizations, selectedOrgId],
  );

  const orgOptions: SelectorOption[] = useMemo(
    () => organizations.map((org) => ({
      label: org.name,
      value: org.id,
      coverImage: org.logoUrl || org.logo || undefined,
    })),
    [organizations],
  );

  const loadOrganizations = useCallback(async () => {
    const response = await apiFetch('/organizations');
    if (!response.ok) throw new Error('Failed to load organizations');
    const data = await response.json();
    const rows = (data.organizations || []) as Organization[];
    setOrganizations(rows);
    setSelectedOrgId((current) => current && rows.some((r) => r.id === current) ? current : (rows[0]?.id || ''));
  }, [apiFetch]);

  const loadOrganizationUsers = useCallback(async () => {
    if (!selectedOrgId) return;
    const response = await apiFetch(`/organizations/${selectedOrgId}/users`);
    if (!response.ok) throw new Error('Failed to load organization users');
    const data = await response.json();
    setOrgUsers((data.users || []) as OrganizationUser[]);
  }, [apiFetch, selectedOrgId]);

  useEffect(() => {
    if (!isSuperadmin) { setLoading(false); return; }
    (async () => {
      setLoading(true); setError('');
      try { await loadOrganizations(); }
      catch (e: any) { setError(e?.message || 'Failed to load organizations'); }
      finally { setLoading(false); }
    })();
  }, [isSuperadmin, loadOrganizations]);

  useEffect(() => {
    if (!selectedOrgId || !isSuperadmin || activeTab !== 'org') return;
    (async () => {
      try { await loadOrganizationUsers(); }
      catch (e: any) { setError(e?.message || 'Failed to load organization users'); }
    })();
  }, [activeTab, isSuperadmin, loadOrganizationUsers, selectedOrgId]);

  // ─────────── upload helper ───────────
  const uploadOrgLogo = async (setUrl: (u: string) => void, setUploading: (b: boolean) => void) => {
    try {
      setUploading(true);
      const picked = await pickFileAsDataUrl('image/*', 'Logo upload is available on web. On mobile, please use web for upload.');
      const res = await apiFetch('/assets/upload', {
        method: 'POST',
        body: JSON.stringify({
          dataUrl: picked.dataUrl,
          fileName: picked.fileName,
          mimeType: picked.mimeType,
          mediaType: 'image',
          context: 'org_logo',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Upload failed');
      }
      const payload = await res.json();
      setUrl(String(payload.url || ''));
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  // ─────────── create org ───────────
  const handleCreateOrganization = async () => {
    setError('');
    if (!orgName.trim() || !orgSubdomain.trim()) {
      setError('Organization name and subdomain are required.');
      return;
    }
    const response = await apiFetch('/organizations', {
      method: 'POST',
      body: JSON.stringify({
        name: orgName.trim(),
        subdomain: orgSubdomain.trim().toLowerCase(),
        logoUrl: orgLogoUrl.trim() || undefined,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.message || 'Failed to create organization');
      return;
    }
    setOrgName(''); setOrgSubdomain(''); setOrgLogoUrl('');
    await loadOrganizations();
  };

  // ─────────── edit org ───────────
  const openEditOrg = () => {
    if (!selectedOrg) return;
    setEditName(selectedOrg.name);
    setEditSubdomain(selectedOrg.subdomain);
    setEditLogoUrl(selectedOrg.logoUrl || selectedOrg.logo || '');
    setEditIsDefault(Boolean(selectedOrg.isDefault));
    setEditOpen(true);
  };

  const handleSaveEditOrg = async () => {
    if (!selectedOrg) return;
    setEditSaving(true);
    try {
      const response = await apiFetch(`/organizations/${selectedOrg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          subdomain: editSubdomain.trim().toLowerCase(),
          logoUrl: editLogoUrl.trim() || null,
          isDefault: editIsDefault,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        Alert.alert('Update failed', payload.message || 'Failed to update organization');
        return;
      }
      await loadOrganizations();
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteOrg = () => {
    if (!selectedOrg) return;
    if (selectedOrg.isDefault) {
      Alert.alert('Cannot delete', 'This is the default organization and cannot be deleted.');
      return;
    }
    Alert.alert(
      'Delete organization',
      `Delete "${selectedOrg.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await apiFetch(`/organizations/${selectedOrg.id}`, { method: 'DELETE' });
            if (!response.ok && response.status !== 204) {
              const payload = await response.json().catch(() => ({}));
              Alert.alert('Delete failed', payload.message || 'Failed to delete organization');
              return;
            }
            setEditOpen(false);
            await loadOrganizations();
          },
        },
      ],
    );
  };

  // ─────────── add user ───────────
  const openAddUser = () => {
    setUserFirstName(''); setUserLastName(''); setUserEmail('');
    setUserMobile(''); setUserPassword(''); setUserRole('student');
    setUserClassLevel(''); setUserBranch('');
    setAddUserOpen(true);
  };

  const handleSaveNewUser = async () => {
    if (!selectedOrg) return;
    if (!userFirstName.trim() || !userLastName.trim() || !userEmail.trim()) {
      Alert.alert('Missing fields', 'First name, last name and email are required.');
      return;
    }
    setUserSaving(true);
    try {
      const body: Record<string, any> = {
        firstName: userFirstName.trim(),
        lastName: userLastName.trim(),
        email: userEmail.trim().toLowerCase(),
        role: userRole,
        organizationId: selectedOrg.id,
      };
      if (userMobile.trim()) body.mobileNumber = userMobile.trim();
      if (userPassword.trim()) body.password = userPassword.trim();
      if (userClassLevel.trim()) body.classLevel = userClassLevel.trim();
      if (userBranch.trim()) body.branch = userBranch.trim();
      const response = await apiFetch('/users', { method: 'POST', body: JSON.stringify(body) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        Alert.alert('Create user failed', payload.message || 'Failed to create user');
        return;
      }
      setAddUserOpen(false);
      await loadOrganizationUsers();
    } finally {
      setUserSaving(false);
    }
  };

  // ─────────── assign user ───────────
  const openAssignUser = () => {
    setAssignSearch(''); setAssignResults([]); setAssignSelectedUser(null);
    setAssignTargetOrgId(''); setAssignSearching(false);
    setAssignOpen(true);
  };

  const runAssignSearch = async (q: string) => {
    setAssignSearch(q);
    if (q.trim().length < 2) { setAssignResults([]); setAssignSearching(false); return; }
    setAssignSearching(true);
    try {
      // Search within the currently-selected (source) org's members.
      const response = await apiFetch(`/organizations/${selectedOrgId}/users?search=${encodeURIComponent(q.trim())}`);
      if (!response.ok) { setAssignResults([]); return; }
      const data = await response.json();
      const users = (data.users || []) as OrganizationUser[];
      setAssignResults(users.slice(0, 25));
    } catch {
      setAssignResults([]);
    } finally {
      setAssignSearching(false);
    }
  };

  const handleAssign = async () => {
    if (!assignSelectedUser || !assignTargetOrgId || !selectedOrg) return;
    if (assignTargetOrgId === selectedOrg.id) {
      Alert.alert('Same organization', 'Pick a different organization to move the user to.');
      return;
    }
    setAssignSaving(true);
    try {
      const response = await apiFetch(`/users/${assignSelectedUser.id}/organization-membership`, {
        method: 'PATCH',
        body: JSON.stringify({
          fromOrganizationId: selectedOrg.id,
          toOrganizationId: assignTargetOrgId,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        Alert.alert('Assign failed', payload.message || 'Failed to move user');
        return;
      }
      setAssignOpen(false);
      await loadOrganizationUsers();
    } finally {
      setAssignSaving(false);
    }
  };

  // ─────────── members ───────────
  const handleToggleGlobalPublish = async (targetUser: OrganizationUser) => {
    if (!selectedOrgId) return;
    setError('');
    const response = await apiFetch(`/users/${targetUser.id}/global-publish-permission`, {
      method: 'PATCH',
      body: JSON.stringify({
        organizationId: selectedOrgId,
        enabled: !targetUser.canPublishGlobal,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.message || 'Failed to update global publish permission');
      return;
    }
    await loadOrganizationUsers();
  };

  if (!isSuperadmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.restrictedText}>Superadmin controls are restricted.</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}>
          <ShieldCheck size={22} color={Colors.primary} />
        </View>
        <View style={styles.heroMeta}>
          <Text style={styles.heroTitle}>Superadmin Console</Text>
          <Text style={styles.heroSub}>Manage tenants, billing and plan catalog across the platform.</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[styles.tabPill, active && styles.tabPillActive]}>
              <Icon size={14} color={active ? '#FFFFFF' : Colors.primary} />
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{tab.label}</Text>
              <Text style={[styles.tabPillSub, active && styles.tabPillSubActive]}>{tab.description}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {activeTab === 'org' ? (
        <View style={styles.gap}>
          {/* ── Selected-org card ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Building2 size={16} color={Colors.primary} />
              <Text style={styles.cardTitle}>Organization</Text>
            </View>

            <Pressable style={styles.orgSelector} onPress={() => setOrgPickerOpen(true)}>
              <View style={styles.orgSelectorIcon}>
                {selectedOrg?.logoUrl || selectedOrg?.logo ? (
                  <Image source={{ uri: selectedOrg.logoUrl || selectedOrg.logo || '' }} style={styles.orgSelectorImage} />
                ) : (
                  <Building2 size={18} color={Colors.primary} />
                )}
              </View>
              <View style={styles.orgSelectorMeta}>
                <Text style={styles.orgSelectorName} numberOfLines={1}>
                  {selectedOrg?.name || 'Select an organization'}
                </Text>
                <Text style={styles.orgSelectorSub} numberOfLines={1}>
                  {selectedOrg?.subdomain || `${organizations.length} organizations`}
                </Text>
              </View>
              <ChevronDown size={18} color={Colors.textMuted} />
            </Pressable>

            <View style={styles.actionRow}>
              <Pressable style={styles.primaryBtn} onPress={openAddUser} disabled={!selectedOrg}>
                <UserPlus size={14} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Add User</Text>
              </Pressable>
              <Pressable style={styles.outlineBtn} onPress={openAssignUser} disabled={!selectedOrg}>
                <Users size={14} color={Colors.primary} />
                <Text style={styles.outlineBtnText}>Assign User</Text>
              </Pressable>
              <Pressable style={styles.outlineBtn} onPress={openEditOrg} disabled={!selectedOrg}>
                <Pencil size={14} color={Colors.primary} />
                <Text style={styles.outlineBtnText}>Edit Org</Text>
              </Pressable>
            </View>
          </View>

          {/* ── Create new org ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Building2 size={16} color={Colors.primary} />
              <Text style={styles.cardTitle}>Create new organization</Text>
            </View>
            <View style={styles.formGrid}>
              <TextInput style={styles.input} placeholder="Org name" placeholderTextColor={Colors.textDisabled} value={orgName} onChangeText={setOrgName} />
              <TextInput style={styles.input} placeholder="Subdomain" placeholderTextColor={Colors.textDisabled} value={orgSubdomain} onChangeText={setOrgSubdomain} autoCapitalize="none" />
            </View>
            <LogoUploader
              url={orgLogoUrl}
              uploading={orgLogoUploading}
              onPick={() => uploadOrgLogo(setOrgLogoUrl, setOrgLogoUploading)}
              onClear={() => setOrgLogoUrl('')}
            />
            <Pressable style={styles.primaryBtn} onPress={handleCreateOrganization}>
              <UserPlus size={14} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Create Organization</Text>
            </Pressable>
          </View>

          {/* ── Members ── */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Users size={16} color={Colors.primary} />
              <Text style={styles.cardTitle}>
                Members {selectedOrg ? `· ${selectedOrg.name}` : ''}
              </Text>
            </View>
            {orgUsers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No members in this organization yet.</Text>
              </View>
            ) : (
              <View style={styles.memberList}>
                {orgUsers.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberMain}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {(member.firstName?.[0] || '').toUpperCase()}{(member.lastName?.[0] || '').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberMeta}>
                        <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
                        <Text style={styles.memberSub}>{member.email}</Text>
                        <Text style={styles.memberRole}>{member.activeRole.toUpperCase()}</Text>
                      </View>
                    </View>
                    {member.roles.includes('teacher') ? (
                      <Pressable style={styles.ghostBtn} onPress={() => handleToggleGlobalPublish(member)}>
                        <Text style={styles.ghostBtnText}>
                          {member.canPublishGlobal ? 'Disable Global' : 'Enable Global'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      ) : null}

      {activeTab === 'billing' ? (
        <BillingPanel
          mode="superadmin"
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onSelectOrg={setSelectedOrgId}
        />
      ) : null}

      {activeTab === 'plans' ? (
        <PlansPanel
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onSelectOrg={setSelectedOrgId}
          canManagePlans
        />
      ) : null}

      {/* ── Org picker modal ── */}
      <SelectorModal
        visible={orgPickerOpen}
        title="Select Organization"
        options={orgOptions}
        selected={selectedOrgId}
        showAny={false}
        onSelect={(value) => setSelectedOrgId(value)}
        onClose={() => setOrgPickerOpen(false)}
      />

      {/* ── Edit org modal ── */}
      <FormModal
        visible={editOpen}
        icon={Building2}
        title={`Edit ${selectedOrg?.name || 'organization'}`}
        subtitle="Update branding, identity, and tenant defaults."
        onClose={() => setEditOpen(false)}
        footer={(
          <View style={styles.modalFooter}>
            <Pressable
              style={[styles.dangerBtn, selectedOrg?.isDefault && styles.dangerBtnDisabled]}
              onPress={handleDeleteOrg}
              disabled={Boolean(selectedOrg?.isDefault)}
            >
              <Trash2 size={14} color="#FFFFFF" />
              <Text style={styles.dangerBtnText}>Delete</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.outlineBtn} onPress={() => setEditOpen(false)}>
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={handleSaveEditOrg} disabled={editSaving}>
              {editSaving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.primaryBtnText}>Save changes</Text>}
            </Pressable>
          </View>
        )}
      >
        <View style={styles.orgPreviewCard}>
          <View style={styles.orgPreviewLogo}>
            {editLogoUrl
              ? <Image source={{ uri: editLogoUrl }} style={styles.orgPreviewImage} resizeMode="cover" />
              : <Building2 size={22} color={Colors.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.orgPreviewName} numberOfLines={1}>
              {editName.trim() || selectedOrg?.name || 'Untitled organization'}
            </Text>
            <Text style={styles.orgPreviewSub} numberOfLines={1}>
              {editSubdomain ? `${editSubdomain.toLowerCase()}.els.ai` : 'no-subdomain'}
            </Text>
          </View>
          {selectedOrg?.isDefault ? (
            <View style={styles.orgPreviewBadge}>
              <ShieldCheck size={10} color={Colors.primary} />
              <Text style={styles.orgPreviewBadgeText}>DEFAULT</Text>
            </View>
          ) : null}
        </View>

        <FormSection title="Identity" hint="The name and subdomain shown across the platform.">
          <Field label="Organization name" required>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Acme Public School"
              placeholderTextColor={Colors.textDisabled}
              value={editName}
              onChangeText={setEditName}
            />
          </Field>
          <Field label="Subdomain" required hint="Lowercase, used in tenant URLs." last>
            <TextInput
              style={styles.fieldInput}
              placeholder="acme"
              placeholderTextColor={Colors.textDisabled}
              value={editSubdomain}
              onChangeText={setEditSubdomain}
              autoCapitalize="none"
            />
          </Field>
        </FormSection>

        <FormSection title="Branding" hint="Square logo recommended. Shown in headers and pickers.">
          <LogoUploader
            url={editLogoUrl}
            uploading={editLogoUploading}
            onPick={() => uploadOrgLogo(setEditLogoUrl, setEditLogoUploading)}
            onClear={() => setEditLogoUrl('')}
          />
        </FormSection>

        <FormSection title="Tenant settings" hint="Configure tenant-wide defaults.">
          <Pressable
            style={[styles.toggleCard, editIsDefault && styles.toggleCardActive]}
            onPress={() => setEditIsDefault((b) => !b)}
          >
            <View style={[styles.toggleCardCheckbox, editIsDefault && styles.checkboxOn]}>
              {editIsDefault ? <Check size={12} color="#FFFFFF" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleCardTitle}>Set as default organization</Text>
              <Text style={styles.toggleCardSub}>New sign-ups without an org assignment will land here.</Text>
            </View>
          </Pressable>
        </FormSection>
      </FormModal>

      {/* ── Add user modal ── */}
      <FormModal
        visible={addUserOpen}
        icon={UserPlus}
        title="Add a new user"
        subtitle={selectedOrg ? `They will join ${selectedOrg.name} and get sign-in access.` : undefined}
        onClose={() => setAddUserOpen(false)}
        footer={(
          <View style={styles.modalFooter}>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.outlineBtn} onPress={() => setAddUserOpen(false)}>
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryBtn,
                (userSaving || !userFirstName.trim() || !userLastName.trim() || !userEmail.trim()) && styles.primaryBtnDisabled,
              ]}
              onPress={handleSaveNewUser}
              disabled={userSaving || !userFirstName.trim() || !userLastName.trim() || !userEmail.trim()}
            >
              {userSaving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : (
                  <>
                    <UserPlus size={14} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Create user</Text>
                  </>
                )}
            </Pressable>
          </View>
        )}
      >
        <FormSection title="Identity" hint="Basic profile information.">
          <FormRow>
            <Field label="First name" required flex={1}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Aisha"
                placeholderTextColor={Colors.textDisabled}
                value={userFirstName}
                onChangeText={setUserFirstName}
              />
            </Field>
            <View style={styles.formRowSpacer} />
            <Field label="Last name" required flex={1}>
              <TextInput
                style={styles.fieldInput}
                placeholder="Khan"
                placeholderTextColor={Colors.textDisabled}
                value={userLastName}
                onChangeText={setUserLastName}
              />
            </Field>
          </FormRow>

          <Field label="Email address" required hint="Used to sign in. Must be unique.">
            <TextInput
              style={styles.fieldInput}
              placeholder="aisha@example.com"
              placeholderTextColor={Colors.textDisabled}
              value={userEmail}
              onChangeText={setUserEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>

          <Field label="Mobile number" hint="Optional. Used for OTP & alerts." last>
            <TextInput
              style={styles.fieldInput}
              placeholder="+91 90000 00000"
              placeholderTextColor={Colors.textDisabled}
              value={userMobile}
              onChangeText={setUserMobile}
              keyboardType="phone-pad"
            />
          </Field>
        </FormSection>

        <FormSection title="Role & access" hint="Pick what this user can do.">
          <Field label="Role" required>
            <View style={styles.rolePickerGrid}>
              {CREATABLE_ROLES.map((role) => {
                const active = userRole === role;
                return (
                  <Pressable
                    key={role}
                    style={[styles.rolePill, active && styles.rolePillActive]}
                    onPress={() => {
                      setUserRole(role);
                      if (role === 'parent' || role === 'admin' || role === 'superadmin') {
                        setUserClassLevel('');
                      }
                    }}
                  >
                    <ShieldCheck size={12} color={active ? '#FFFFFF' : Colors.primary} />
                    <Text style={[styles.rolePillText, active && styles.rolePillTextActive]}>
                      {role.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Password" hint="Leave blank to use the default ‘welcome’ password." last>
            <TextInput
              style={styles.fieldInput}
              placeholder="Set a custom password"
              placeholderTextColor={Colors.textDisabled}
              value={userPassword}
              onChangeText={setUserPassword}
              secureTextEntry
            />
          </Field>
        </FormSection>

        <FormSection title="Profile details" hint="Optional context shown on the user’s profile.">
          {userRole === 'student' || userRole === 'teacher' ? (
            <FormRow>
              <Field label="Standard" flex={1}>
                <Pressable style={styles.selectField} onPress={() => setStandardPickerOpen(true)}>
                  <Text style={[styles.selectFieldText, !userClassLevel && styles.selectFieldPlaceholder]}>
                    {userClassLevel ? getStandardLabel(userClassLevel) : 'Select standard'}
                  </Text>
                  <ChevronDown size={14} color={Colors.textMuted} />
                </Pressable>
              </Field>
              <View style={styles.formRowSpacer} />
              <Field label="Branch / campus" flex={1} last>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. North campus"
                  placeholderTextColor={Colors.textDisabled}
                  value={userBranch}
                  onChangeText={setUserBranch}
                />
              </Field>
            </FormRow>
          ) : (
            <Field label="Branch / campus" last>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. North campus"
                placeholderTextColor={Colors.textDisabled}
                value={userBranch}
                onChangeText={setUserBranch}
              />
            </Field>
          )}
        </FormSection>
      </FormModal>

      <SelectorModal
        visible={standardPickerOpen}
        title="Select standard"
        options={STANDARD_OPTIONS}
        selected={userClassLevel}
        showAny={false}
        onSelect={(value) => setUserClassLevel(value)}
        onClose={() => setStandardPickerOpen(false)}
      />

      {/* ── Assign user modal ── */}
      <FormModal
        visible={assignOpen}
        icon={Users}
        title="Move user to another organization"
        subtitle="Find a user, choose a destination, and we'll handle the move."
        onClose={() => setAssignOpen(false)}
        footer={(
          <View style={styles.modalFooter}>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.outlineBtn} onPress={() => setAssignOpen(false)}>
              <Text style={styles.outlineBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, (!assignSelectedUser || !assignTargetOrgId || assignSaving) && styles.primaryBtnDisabled]}
              onPress={handleAssign}
              disabled={assignSaving || !assignSelectedUser || !assignTargetOrgId}
            >
              {assignSaving
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : (
                  <>
                    <ArrowRight size={14} color="#FFFFFF" />
                    <Text style={[styles.primaryBtnText, { marginLeft: 6 }]}>Move user</Text>
                  </>
                )}
            </Pressable>
          </View>
        )}
      >
        {/* Hero — visual transfer summary */}
        <View style={styles.assignHero}>
          <View style={styles.assignHeroOrg}>
            <View style={styles.assignHeroOrgIcon}>
              {selectedOrg?.logoUrl || selectedOrg?.logo
                ? <Image source={{ uri: selectedOrg.logoUrl || selectedOrg.logo || '' }} style={styles.assignHeroOrgImage} />
                : <Building2 size={18} color={Colors.primary} />}
            </View>
            <Text style={styles.assignHeroLabel}>FROM</Text>
            <Text style={styles.assignHeroOrgName} numberOfLines={1}>{selectedOrg?.name || '—'}</Text>
          </View>

          <View style={styles.assignHeroArrow}>
            <ArrowRight size={18} color={Colors.primary} />
          </View>

          <View style={styles.assignHeroOrg}>
            <View style={[styles.assignHeroOrgIcon, !assignTargetOrgId && styles.assignHeroOrgIconEmpty]}>
              {(() => {
                const target = organizations.find((o) => o.id === assignTargetOrgId);
                if (target?.logoUrl || target?.logo) {
                  return <Image source={{ uri: target.logoUrl || target.logo || '' }} style={styles.assignHeroOrgImage} />;
                }
                return <Building2 size={18} color={assignTargetOrgId ? Colors.primary : Colors.textMuted} />;
              })()}
            </View>
            <Text style={styles.assignHeroLabel}>TO</Text>
            <Text
              style={[styles.assignHeroOrgName, !assignTargetOrgId && styles.assignHeroOrgPlaceholder]}
              numberOfLines={1}
            >
              {organizations.find((o) => o.id === assignTargetOrgId)?.name || 'Pick destination'}
            </Text>
          </View>
        </View>

        {/* ── Step 1 — pick user ── */}
        <View style={styles.formSection}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, assignSelectedUser && styles.stepBadgeDone]}>
              {assignSelectedUser
                ? <Check size={12} color="#FFFFFF" />
                : <Text style={styles.stepBadgeText}>1</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formSectionTitle}>Select a user</Text>
              <Text style={styles.formSectionHint}>From the members of {selectedOrg?.name || 'this organization'}.</Text>
            </View>
          </View>

          <View style={styles.searchInputWrap}>
            <Search size={14} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email…"
              placeholderTextColor={Colors.textDisabled}
              value={assignSearch}
              onChangeText={runAssignSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {assignSearch ? (
              <Pressable onPress={() => runAssignSearch('')} hitSlop={8}>
                <X size={14} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={{ marginTop: 10 }}>
            {assignSelectedUser ? (
              <View style={styles.selectedUserCard}>
                <View style={styles.selectedUserAvatar}>
                  <Text style={styles.selectedUserAvatarText}>
                    {(assignSelectedUser.firstName?.[0] || '').toUpperCase()}{(assignSelectedUser.lastName?.[0] || '').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.selectedUserName}>{assignSelectedUser.firstName} {assignSelectedUser.lastName}</Text>
                  <Text style={styles.selectedUserEmail}>{assignSelectedUser.email}</Text>
                  <View style={styles.selectedUserRolePill}>
                    <ShieldCheck size={10} color={Colors.primary} />
                    <Text style={styles.selectedUserRolePillText}>{assignSelectedUser.activeRole.toUpperCase()}</Text>
                  </View>
                </View>
                <Pressable style={styles.changeUserBtn} onPress={() => setAssignSelectedUser(null)}>
                  <Text style={styles.changeUserBtnText}>Change</Text>
                </Pressable>
              </View>
            ) : assignSearching ? (
              <View style={styles.searchEmpty}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={[styles.searchEmptyText, { marginTop: 6 }]}>Searching…</Text>
              </View>
            ) : assignSearch.trim().length < 2 ? (
              <View style={styles.searchEmpty}>
                <View style={styles.searchEmptyIcon}><Users size={20} color={Colors.textMuted} /></View>
                <Text style={styles.searchEmptyText}>Start typing to find users</Text>
                <Text style={styles.searchEmptyHint}>Search by first name, last name, email or mobile.</Text>
              </View>
            ) : assignResults.length === 0 ? (
              <View style={styles.searchEmpty}>
                <View style={styles.searchEmptyIcon}><Search size={20} color={Colors.textMuted} /></View>
                <Text style={styles.searchEmptyText}>No users match “{assignSearch}”</Text>
                <Text style={styles.searchEmptyHint}>Try a different name or email address.</Text>
              </View>
            ) : (
              <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
                {assignResults.map((u, idx) => (
                  <Pressable
                    key={u.id}
                    style={[styles.searchRow, idx === assignResults.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => setAssignSelectedUser(u)}
                  >
                    <View style={styles.searchAvatar}>
                      <Text style={styles.searchAvatarText}>
                        {(u.firstName?.[0] || '').toUpperCase()}{(u.lastName?.[0] || '').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.searchRowName}>{u.firstName} {u.lastName}</Text>
                      <Text style={styles.searchRowSub}>{u.email}</Text>
                    </View>
                    <Text style={styles.searchRowRole}>{u.activeRole.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>

        {/* ── Step 2 — pick target org ── */}
        <View style={styles.formSection}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, assignTargetOrgId && styles.stepBadgeDone]}>
              {assignTargetOrgId
                ? <Check size={12} color="#FFFFFF" />
                : <Text style={styles.stepBadgeText}>2</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formSectionTitle}>Choose destination</Text>
              <Text style={styles.formSectionHint}>The organization where this user will land.</Text>
            </View>
          </View>

          <Pressable style={styles.targetPickerCard} onPress={() => setAssignTargetPickerOpen(true)}>
            <View style={[styles.targetPickerIcon, !assignTargetOrgId && styles.assignHeroOrgIconEmpty]}>
              {(() => {
                const target = organizations.find((o) => o.id === assignTargetOrgId);
                if (target?.logoUrl || target?.logo) {
                  return <Image source={{ uri: target.logoUrl || target.logo || '' }} style={styles.targetPickerImage} />;
                }
                return <Building2 size={16} color={assignTargetOrgId ? Colors.primary : Colors.textMuted} />;
              })()}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.targetPickerName, !assignTargetOrgId && styles.assignHeroOrgPlaceholder]} numberOfLines={1}>
                {organizations.find((o) => o.id === assignTargetOrgId)?.name || 'Pick a target organization'}
              </Text>
              <Text style={styles.targetPickerSub}>
                {assignTargetOrgId
                  ? (organizations.find((o) => o.id === assignTargetOrgId)?.subdomain || '')
                  : `Choose from ${organizations.length - 1} other ${organizations.length - 1 === 1 ? 'org' : 'orgs'}`}
              </Text>
            </View>
            <ChevronDown size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            This user will be removed from {selectedOrg?.name || 'the source org'} and added to the destination. Their previous org membership is replaced — content they own stays in the source org.
          </Text>
        </View>
      </FormModal>

      <SelectorModal
        visible={assignTargetPickerOpen}
        title="Move user to"
        options={orgOptions.filter((o) => o.value !== selectedOrgId)}
        selected={assignTargetOrgId}
        showAny={false}
        onSelect={(value) => setAssignTargetOrgId(value)}
        onClose={() => setAssignTargetPickerOpen(false)}
      />
    </ScrollView>
  );
}

// ─────────── Helpers ───────────

function FormModal({
  visible, title, subtitle, icon: Icon, footer, onClose, children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  footer?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            {Icon ? (
              <View style={styles.modalHeroIcon}>
                <Icon size={18} color={Colors.primary} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{title}</Text>
              {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseBtn}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalBody}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.modalFooterFixed}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.formSectionTitle}>{title}</Text>
      {hint ? <Text style={styles.formSectionHint}>{hint}</Text> : null}
      <View style={styles.formSectionBody}>{children}</View>
    </View>
  );
}

function Field({
  label, hint, required, children, flex, last,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode; flex?: number; last?: boolean }) {
  return (
    <View
      style={[
        styles.fieldGroup,
        flex !== undefined ? { flex, minWidth: 0 } : { width: '100%' },
        last ? { marginBottom: 0 } : null,
      ]}
    >
      <Text style={styles.fieldLabel}>
        {label}{required ? <Text style={styles.fieldRequired}> *</Text> : null}
      </Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.formRow}>{children}</View>;
}

function LogoUploader({ url, uploading, onPick, onClear }: { url: string; uploading: boolean; onPick: () => void; onClear: () => void }) {
  return (
    <View style={styles.logoUploader}>
      <View style={styles.logoPreview}>
        {url
          ? <Image source={{ uri: url }} style={styles.logoImage} resizeMode="cover" />
          : <ImageIcon size={24} color={Colors.textMuted} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.logoLabel}>{url ? 'Current logo' : 'Upload organization logo'}</Text>
        <Text style={[styles.logoMeta, { marginTop: 2 }]} numberOfLines={1}>
          {url ? (url.split('/').pop() || 'uploaded image') : 'PNG, JPG or SVG up to 5 MB'}
        </Text>
        <View style={styles.logoActions}>
          <Pressable style={styles.outlineBtn} onPress={onPick} disabled={uploading}>
            {uploading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <UploadCloud size={14} color={Colors.primary} />}
            <Text style={[styles.outlineBtnText, { marginLeft: 6 }]}>{url ? 'Replace' : 'Upload'}</Text>
          </Pressable>
          {url ? (
            <Pressable style={[styles.ghostBtn, { marginLeft: 8 }]} onPress={onClear}>
              <X size={12} color={Colors.primary} />
              <Text style={[styles.ghostBtnText, { marginLeft: 4 }]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, paddingBottom: 32, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  restrictedText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: 14, ...Shadow.sm,
  },
  heroIcon: { width: 42, height: 42, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight },
  heroMeta: { flex: 1 },
  heroTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  heroSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  tabStrip: { gap: 8, paddingVertical: 2 },
  tabPill: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10, minWidth: 170, gap: 4, ...Shadow.sm,
  },
  tabPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabPillText: { fontSize: 13, fontWeight: '800', color: Colors.text },
  tabPillTextActive: { color: '#FFFFFF' },
  tabPillSub: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  tabPillSubActive: { color: 'rgba(255,255,255,0.8)' },
  error: { color: Colors.error, fontWeight: '700', fontSize: 12 },
  gap: { gap: 14 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: 14, gap: 12, ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.text },

  orgSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, backgroundColor: Colors.surfaceAlt,
  },
  orgSelectorIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight, overflow: 'hidden' },
  orgSelectorImage: { width: 36, height: 36 },
  orgSelectorMeta: { flex: 1 },
  orgSelectorName: { fontSize: 13, fontWeight: '800', color: Colors.text },
  orgSelectorSub: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    flexBasis: 180, flexGrow: 1,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: Colors.text, justifyContent: 'center',
  },
  inputText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  inputPlaceholder: { color: Colors.textDisabled, fontWeight: '500' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  outlineBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.primaryLight,
  },
  ghostBtnText: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.md, backgroundColor: Colors.error,
  },
  dangerBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  emptyBox: { padding: 16, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, alignItems: 'center' },
  emptyText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  memberList: { gap: 10 },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, backgroundColor: Colors.surfaceAlt,
  },
  memberMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: { width: 36, height: 36, borderRadius: 999, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: Colors.primary, fontWeight: '900', fontSize: 13 },
  memberMeta: { flex: 1, gap: 2 },
  memberName: { fontSize: 13, fontWeight: '800', color: Colors.text },
  memberSub: { fontSize: 11, color: Colors.textSecondary },
  memberRole: { fontSize: 10, color: Colors.primary, fontWeight: '800', letterSpacing: 0.6 },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: 16 },
  modalSheet: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, maxHeight: '90%',
    width: '100%', maxWidth: 640, alignSelf: 'center',
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalHeroIcon: {
    width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 15, fontWeight: '900', color: Colors.text },
  modalSubtitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { flexShrink: 1 },
  modalBody: { padding: 18, paddingBottom: 4 },
  modalFooterFixed: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg,
  },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  formSection: { marginBottom: 22 },
  formSectionTitle: {
    fontSize: 12, fontWeight: '900', color: Colors.text,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
  },
  formSectionHint: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginBottom: 12 },
  formSectionBody: {},

  formRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
  formRowSpacer: { width: 12 },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  fieldRequired: { color: Colors.error, fontWeight: '900' },
  fieldHint: { fontSize: 11, color: Colors.textMuted, fontWeight: '500', marginTop: 6 },
  fieldInput: {
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: Colors.text, width: '100%',
  },


  selectField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 11,
  },
  selectFieldText: { fontSize: 13, fontWeight: '700', color: Colors.text, flex: 1 },
  selectFieldPlaceholder: { color: Colors.textDisabled, fontWeight: '500' },
  roleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryLight, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  roleChipText: { color: Colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },

  rolePickerGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: -8 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginRight: 8, marginBottom: 8,
  },
  rolePillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rolePillText: { fontSize: 11, fontWeight: '900', color: Colors.primary, letterSpacing: 0.6, marginLeft: 6 },
  rolePillTextActive: { color: '#FFFFFF' },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, padding: 14,
  },
  toggleCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  toggleCardCheckbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface,
    marginRight: 12,
  },
  toggleCardTitle: { fontSize: 13, fontWeight: '800', color: Colors.text },
  toggleCardSub: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },

  primaryBtnDisabled: { opacity: 0.55 },
  dangerBtnDisabled: { opacity: 0.45 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceAlt },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxTick: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  toggleLabel: { fontSize: 12, fontWeight: '700', color: Colors.text },

  logoUploader: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, backgroundColor: Colors.surfaceAlt,
  },
  logoPreview: {
    width: 56, height: 56, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
    marginRight: 14,
  },
  logoImage: { width: 56, height: 56 },
  logoLabel: { fontSize: 13, fontWeight: '800', color: Colors.text },
  logoMeta: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  logoActions: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },

  orgPreviewCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18,
  },
  orgPreviewLogo: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginRight: 12,
  },
  orgPreviewImage: { width: 48, height: 48 },
  orgPreviewName: { fontSize: 14, fontWeight: '900', color: Colors.text },
  orgPreviewSub: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  orgPreviewBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.primary,
  },
  orgPreviewBadgeText: { color: Colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginLeft: 4 },

  // Assign-user modal — hero
  assignHero: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primaryLight, borderRadius: Radius.md,
    paddingHorizontal: 14, paddingVertical: 14, marginBottom: 18,
  },
  assignHeroOrg: { flex: 1, alignItems: 'center' },
  assignHeroOrgIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 6,
  },
  assignHeroOrgIconEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border },
  assignHeroOrgImage: { width: 44, height: 44 },
  assignHeroLabel: {
    fontSize: 9, fontWeight: '900', letterSpacing: 0.6,
    color: Colors.textMuted, marginBottom: 2,
  },
  assignHeroOrgName: { fontSize: 12, fontWeight: '900', color: Colors.text, textAlign: 'center' },
  assignHeroOrgPlaceholder: { color: Colors.textMuted, fontWeight: '600' },
  assignHeroArrow: {
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 6, marginTop: -10,
  },

  // Assign-user modal — step header
  stepHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stepBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  stepBadgeDone: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepBadgeText: { fontSize: 11, fontWeight: '900', color: Colors.textSecondary },
  stepTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: Colors.text },

  // Assign-user modal — search
  searchInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 13, color: Colors.text },

  searchEmpty: {
    paddingVertical: 22, paddingHorizontal: 14,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.border,
    alignItems: 'center',
  },
  searchEmptyIcon: {
    width: 40, height: 40, borderRadius: 999,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  searchEmptyText: { fontSize: 12, fontWeight: '800', color: Colors.text },
  searchEmptyHint: {
    fontSize: 11, color: Colors.textMuted, fontWeight: '600',
    textAlign: 'center', marginTop: 4,
  },

  searchResults: {
    maxHeight: 240,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, backgroundColor: Colors.surface,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchRowActive: { backgroundColor: Colors.primaryLight },
  searchAvatar: {
    width: 34, height: 34, borderRadius: 999,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  searchAvatarText: { color: Colors.primary, fontWeight: '900', fontSize: 12 },
  searchRowName: { fontSize: 13, fontWeight: '800', color: Colors.text },
  searchRowSub: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },
  searchRowRole: {
    fontSize: 9, fontWeight: '900', letterSpacing: 0.5, color: Colors.primary,
    backgroundColor: Colors.primaryLight, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8,
  },

  // Assign-user modal — selected user
  selectedUserCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md, padding: 12,
  },
  selectedUserAvatar: {
    width: 44, height: 44, borderRadius: 999,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  selectedUserAvatarText: { color: Colors.primary, fontSize: 14, fontWeight: '900' },
  selectedUserName: { fontSize: 14, fontWeight: '900', color: Colors.text },
  selectedUserEmail: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600', marginTop: 2 },
  selectedUserRolePill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: Colors.surface, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3, marginTop: 6,
    borderWidth: 1, borderColor: Colors.primary,
  },
  selectedUserRolePillText: {
    color: Colors.primary, fontSize: 9, fontWeight: '900',
    letterSpacing: 0.6, marginLeft: 4,
  },

  changeUserBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primary,
  },
  changeUserBtnText: { fontSize: 11, fontWeight: '800', color: Colors.primary },

  // Assign-user modal — target picker
  targetPickerCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, padding: 12,
  },
  targetPickerIcon: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  targetPickerImage: { width: 40, height: 40 },
  targetPickerName: { fontSize: 13, fontWeight: '800', color: Colors.text },
  targetPickerSub: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },

  // Assign-user modal — warning callout
  warnBox: {
    flexDirection: 'row',
    backgroundColor: Colors.warningLight || '#FEF3C7',
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
    borderLeftWidth: 3, borderLeftColor: Colors.warning || '#F59E0B',
    marginTop: 4,
  },
  warnText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#92400E', lineHeight: 16 },
});
