import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Building2, CreditCard, Layers, ShieldCheck, UserPlus, Users } from 'lucide-react-native';

import { useAuth } from '../../src/context/AuthContext';
import { Colors, Radius, Shadow } from '../../src/theme';
import { BillingPanel } from '../../src/components/billing/BillingPanel';
import { PlansPanel } from '../../src/components/billing/PlansPanel';

type Organization = {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string;
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

export default function SuperadminPage() {
  const { user, apiFetch } = useAuth();
  const isSuperadmin = user?.activeRole === 'superadmin' || user?.roles?.includes('superadmin');

  const [activeTab, setActiveTab] = useState<SuperadminTab>('billing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [orgUsers, setOrgUsers] = useState<OrganizationUser[]>([]);

  const [orgName, setOrgName] = useState('');
  const [orgSubdomain, setOrgSubdomain] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');

  const selectedOrg = useMemo(
    () => organizations.find((item) => item.id === selectedOrgId) || null,
    [organizations, selectedOrgId],
  );

  const loadOrganizations = useCallback(async () => {
    const response = await apiFetch('/organizations');
    if (!response.ok) throw new Error('Failed to load organizations');
    const data = await response.json();
    const rows = (data.organizations || []) as Organization[];
    setOrganizations(rows);
    if (!selectedOrgId && rows.length > 0) setSelectedOrgId(rows[0].id);
  }, [apiFetch, selectedOrgId]);

  const loadOrganizationUsers = useCallback(async () => {
    if (!selectedOrgId) return;
    const response = await apiFetch(`/organizations/${selectedOrgId}/users`);
    if (!response.ok) throw new Error('Failed to load organization users');
    const data = await response.json();
    setOrgUsers((data.users || []) as OrganizationUser[]);
  }, [apiFetch, selectedOrgId]);

  useEffect(() => {
    if (!isSuperadmin) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        await loadOrganizations();
      } catch (e: any) {
        setError(e?.message || 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    })();
  }, [isSuperadmin, loadOrganizations]);

  useEffect(() => {
    if (!selectedOrgId || !isSuperadmin) return;
    if (activeTab !== 'org') return;
    (async () => {
      try {
        await loadOrganizationUsers();
      } catch (e: any) {
        setError(e?.message || 'Failed to load organization users');
      }
    })();
  }, [activeTab, isSuperadmin, loadOrganizationUsers, selectedOrgId]);

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
        subdomain: orgSubdomain.trim(),
        logoUrl: orgLogoUrl.trim() || undefined,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.message || 'Failed to create organization');
      return;
    }
    setOrgName('');
    setOrgSubdomain('');
    setOrgLogoUrl('');
    await loadOrganizations();
  };

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

  const handleMoveUser = async (targetUser: OrganizationUser, toOrganizationId: string) => {
    if (!selectedOrgId || !toOrganizationId || selectedOrgId === toOrganizationId) return;
    setError('');
    const response = await apiFetch(`/users/${targetUser.id}/organization-membership`, {
      method: 'PATCH',
      body: JSON.stringify({ fromOrganizationId: selectedOrgId, toOrganizationId }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.message || 'Failed to move user');
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
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Building2 size={16} color={Colors.primary} />
              <Text style={styles.cardTitle}>Organizations</Text>
            </View>
            <View style={styles.orgGrid}>
              {organizations.map((org) => {
                const active = selectedOrgId === org.id;
                return (
                  <Pressable
                    key={org.id}
                    onPress={() => setSelectedOrgId(org.id)}
                    style={[styles.orgChip, active && styles.orgChipActive]}
                  >
                    <Text style={[styles.orgChipText, active && styles.orgChipTextActive]} numberOfLines={1}>{org.name}</Text>
                    <Text style={[styles.orgChipSub, active && styles.orgChipSubActive]} numberOfLines={1}>{org.subdomain}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.createOrgGrid}>
              <TextInput style={styles.input} placeholder="Org name" placeholderTextColor={Colors.textDisabled} value={orgName} onChangeText={setOrgName} />
              <TextInput style={styles.input} placeholder="Subdomain" placeholderTextColor={Colors.textDisabled} value={orgSubdomain} onChangeText={setOrgSubdomain} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Logo URL (optional)" placeholderTextColor={Colors.textDisabled} value={orgLogoUrl} onChangeText={setOrgLogoUrl} autoCapitalize="none" />
            </View>
            <Pressable style={styles.primaryBtn} onPress={handleCreateOrganization}>
              <UserPlus size={14} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Create Organization</Text>
            </Pressable>
          </View>

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
                    <View style={styles.memberActions}>
                      {member.roles.includes('teacher') ? (
                        <Pressable style={styles.ghostBtn} onPress={() => handleToggleGlobalPublish(member)}>
                          <Text style={styles.ghostBtnText}>
                            {member.canPublishGlobal ? 'Disable Global' : 'Enable Global'}
                          </Text>
                        </Pressable>
                      ) : null}
                      {organizations
                        .filter((org) => org.id !== selectedOrgId)
                        .slice(0, 2)
                        .map((org) => (
                          <Pressable key={org.id} style={styles.outlineBtn} onPress={() => handleMoveUser(member, org.id)}>
                            <Text style={styles.outlineBtnText}>Move → {org.subdomain}</Text>
                          </Pressable>
                        ))}
                    </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    paddingBottom: 32,
    gap: 14,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  restrictedText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    ...Shadow.sm,
  },
  heroIcon: {
    width: 42, height: 42, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primaryLight,
  },
  heroMeta: { flex: 1 },
  heroTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  heroSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  tabStrip: { gap: 8, paddingVertical: 2 },
  tabPill: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10,
    minWidth: 170, gap: 4, ...Shadow.sm,
  },
  tabPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabPillText: { fontSize: 13, fontWeight: '800', color: Colors.text },
  tabPillTextActive: { color: '#FFFFFF' },
  tabPillSub: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  tabPillSubActive: { color: 'rgba(255,255,255,0.8)' },
  error: { color: Colors.error, fontWeight: '700', fontSize: 12 },
  gap: { gap: 14 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.border, padding: 14, gap: 10, ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.text },
  orgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  orgChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border, gap: 2,
  },
  orgChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  orgChipText: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
  orgChipTextActive: { color: Colors.primary },
  orgChipSub: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  orgChipSubActive: { color: Colors.primary },
  createOrgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    flexBasis: 180, flexGrow: 1,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: Colors.text,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  emptyBox: { padding: 16, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, alignItems: 'center' },
  emptyText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  memberList: { gap: 10 },
  memberCard: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, gap: 10, backgroundColor: Colors.surfaceAlt,
  },
  memberMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 999, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { color: Colors.primary, fontWeight: '900', fontSize: 13 },
  memberMeta: { flex: 1, gap: 2 },
  memberName: { fontSize: 13, fontWeight: '800', color: Colors.text },
  memberSub: { fontSize: 11, color: Colors.textSecondary },
  memberRole: { fontSize: 10, color: Colors.primary, fontWeight: '800', letterSpacing: 0.6 },
  memberActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ghostBtn: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  ghostBtnText: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  outlineBtn: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.md,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  outlineBtnText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
});
