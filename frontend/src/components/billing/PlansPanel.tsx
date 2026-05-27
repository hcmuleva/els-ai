import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, CheckCircle2, CircleDot, Crown, PackagePlus, Power, Sparkles, Star, Tag, Users, Wallet } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Shadow } from '../../theme';
import { SubscriptionPlan, formatCurrency, tierTheme } from '../../utils/billing';
import { PlanCard } from './PlanCard';

type Organization = { id: string; name: string; subdomain: string };

type Subscription = {
  id?: string;
  status?: string;
  plan_id?: string | null;
  ends_at?: string | null;
  trial_end_at?: string | null;
  final_price?: number | null;
  seat_count?: number | null;
};

const TIER_OPTIONS: Array<SubscriptionPlan['membershipTier']> = ['bronze', 'silver', 'gold', 'platinum'];
const CYCLE_OPTIONS: Array<SubscriptionPlan['billingCycle']> = ['monthly', 'quarterly', 'yearly'];

type Props = {
  organizations: Organization[];
  selectedOrgId: string;
  onSelectOrg: (id: string) => void;
  canManagePlans: boolean;
};

export function PlansPanel({ organizations, selectedOrgId, onSelectOrg, canManagePlans }: Props) {
  const { apiFetch } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [seatCount, setSeatCount] = useState('25');
  const [extraDiscount, setExtraDiscount] = useState('0');

  const [showCreate, setShowCreate] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftTier, setDraftTier] = useState<SubscriptionPlan['membershipTier']>('silver');
  const [draftCycle, setDraftCycle] = useState<SubscriptionPlan['billingCycle']>('monthly');
  const [draftBase, setDraftBase] = useState('1999');
  const [draftOffer, setDraftOffer] = useState('10');
  const [draftSpecial, setDraftSpecial] = useState('5');
  const [draftGroup, setDraftGroup] = useState('5');
  const [draftThreshold, setDraftThreshold] = useState('25');
  const [creating, setCreating] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/billing/plans');
      if (!response.ok) throw new Error('Failed to load plans');
      const data = await response.json();
      const rows = (data.plans || []) as SubscriptionPlan[];
      setPlans(rows);
      if (!selectedPlanId && rows.length > 0) setSelectedPlanId(rows[0].id);
    } catch (e: any) {
      setError(e?.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, selectedPlanId]);

  const loadSubscription = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const response = await apiFetch(`/billing/organizations/${selectedOrgId}/subscription`);
      if (!response.ok) return;
      const data = await response.json();
      setSubscription((data.subscription || null) as Subscription | null);
    } catch (_e) { /* ignore */ }
  }, [apiFetch, selectedOrgId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { loadSubscription(); }, [loadSubscription]);

  const handleAssign = async (plan: SubscriptionPlan) => {
    if (!selectedOrgId) {
      setError('Pick an organization first.');
      return;
    }
    setAssigning(plan.id);
    setError('');
    setInfo('');
    try {
      const response = await apiFetch(`/billing/organizations/${selectedOrgId}/subscribe`, {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.id,
          seatCount: Number(seatCount || 1),
          extraSpecialDiscountPercent: Number(extraDiscount || 0),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to assign plan');
      }
      setInfo(`Plan ${plan.name} activated for the selected organization.`);
      await loadSubscription();
    } catch (e: any) {
      setError(e?.message || 'Failed to assign plan');
    } finally {
      setAssigning('');
    }
  };

  const handleCreatePlan = async () => {
    if (!draftName.trim()) {
      setError('Plan name is required.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const response = await apiFetch('/billing/plans', {
        method: 'POST',
        body: JSON.stringify({
          name: draftName.trim(),
          description: draftDesc.trim() || undefined,
          membershipTier: draftTier,
          billingCycle: draftCycle,
          basePrice: Number(draftBase || 0),
          offerDiscountPercent: Number(draftOffer || 0),
          specialDiscountPercent: Number(draftSpecial || 0),
          groupDiscountPercent: Number(draftGroup || 0),
          maxUsersForGroupDiscount: Number(draftThreshold || 1),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to create plan');
      }
      setDraftName('');
      setDraftDesc('');
      setInfo('Plan created.');
      await loadPlans();
    } catch (e: any) {
      setError(e?.message || 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePlanActive = async (plan: SubscriptionPlan) => {
    setError('');
    try {
      const response = await apiFetch(`/billing/plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to update plan');
      }
      await loadPlans();
    } catch (e: any) {
      setError(e?.message || 'Failed to update plan');
    }
  };

  const selectedOrg = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId) || null,
    [organizations, selectedOrgId],
  );
  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === subscription?.plan_id) || null,
    [plans, subscription?.plan_id],
  );

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Wallet size={16} color={Colors.primary} />
          <Text style={styles.cardTitle}>Target Organization</Text>
        </View>
        <Text style={styles.helperText}>Plans you activate here apply to this organization.</Text>
        <View style={styles.orgGrid}>
          {organizations.map((org) => {
            const active = selectedOrgId === org.id;
            return (
              <Pressable
                key={org.id}
                onPress={() => onSelectOrg(org.id)}
                style={[styles.orgChip, active && styles.orgChipActive]}
              >
                <CircleDot size={11} color={active ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.orgChipText, active && styles.orgChipTextActive]} numberOfLines={1}>{org.name}</Text>
                <Text style={[styles.orgChipSub, active && styles.orgChipSubActive]} numberOfLines={1}>{org.subdomain}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {currentPlan ? (
        <View style={[styles.card, styles.currentPlanCard]}>
          <View style={styles.cardHeader}>
            <Crown size={16} color={tierTheme(currentPlan.membershipTier).accent} />
            <Text style={styles.cardTitle}>Current Plan {selectedOrg ? `· ${selectedOrg.name}` : ''}</Text>
          </View>
          <View style={styles.currentPlanRow}>
            <View style={styles.currentPlanMeta}>
              <Text style={styles.currentPlanName}>{currentPlan.name}</Text>
              <Text style={styles.currentPlanSub}>
                {currentPlan.membershipTier.toUpperCase()} · {currentPlan.billingCycle.toUpperCase()}
              </Text>
              <Text style={styles.currentPlanSub}>
                Status: {(subscription?.status || 'NA').toUpperCase()} · {formatCurrency(subscription?.final_price ?? currentPlan.basePrice)}
              </Text>
            </View>
            <View style={[styles.tierBadge, { backgroundColor: tierTheme(currentPlan.membershipTier).accent }]}>
              <Sparkles size={11} color="#FFFFFF" />
              <Text style={styles.tierBadgeText}>{tierTheme(currentPlan.membershipTier).label}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {info ? (
        <View style={styles.infoBanner}>
          <CheckCircle2 size={14} color={Colors.success} />
          <Text style={styles.infoText}>{info}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBanner}>
          <AlertTriangle size={14} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Tag size={16} color={Colors.primary} />
          <Text style={styles.cardTitle}>Assignment Settings</Text>
        </View>
        <View style={styles.inputsRow}>
          <View style={styles.inputCell}>
            <Text style={styles.label}>Seat count</Text>
            <View style={styles.inputWrap}>
              <Users size={14} color={Colors.textMuted} />
              <TextInput value={seatCount} onChangeText={setSeatCount} keyboardType="numeric" style={styles.input} />
            </View>
          </View>
          <View style={styles.inputCell}>
            <Text style={styles.label}>Extra discount %</Text>
            <View style={styles.inputWrap}>
              <Star size={14} color={Colors.textMuted} />
              <TextInput value={extraDiscount} onChangeText={setExtraDiscount} keyboardType="numeric" style={styles.input} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <PackagePlus size={16} color={Colors.primary} />
          <Text style={styles.cardTitle}>Plan Catalog</Text>
        </View>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : (
          <View style={styles.plansGrid}>
            {plans.map((plan) => (
              <View key={plan.id} style={styles.planCellWrap}>
                <PlanCard
                  plan={plan}
                  selected={selectedPlanId === plan.id}
                  recommended={plan.membershipTier === 'gold'}
                  onSelect={() => setSelectedPlanId(plan.id)}
                  onAssign={canManagePlans ? () => handleAssign(plan) : undefined}
                  assigning={assigning === plan.id}
                  rightAction={canManagePlans ? (
                    <Pressable style={styles.toggleBtn} onPress={() => handleTogglePlanActive(plan)}>
                      <Power size={12} color={plan.isActive === false ? Colors.error : Colors.success} />
                      <Text style={[styles.toggleBtnText, { color: plan.isActive === false ? Colors.error : Colors.success }]}>
                        {plan.isActive === false ? 'Inactive' : 'Active'}
                      </Text>
                    </Pressable>
                  ) : undefined}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {canManagePlans ? (
        <View style={styles.card}>
          <Pressable style={styles.collapseHeader} onPress={() => setShowCreate((v) => !v)}>
            <PackagePlus size={16} color={Colors.primary} />
            <Text style={styles.cardTitle}>Create New Plan</Text>
            <Text style={styles.collapseToggle}>{showCreate ? '−' : '+'}</Text>
          </Pressable>
          {showCreate ? (
            <View style={styles.createForm}>
              <View style={styles.chipRow}>
                {TIER_OPTIONS.map((tier) => {
                  const active = draftTier === tier;
                  return (
                    <Pressable key={tier} onPress={() => setDraftTier(tier)} style={[styles.tierChip, active && styles.tierChipActive]}>
                      <Text style={[styles.tierChipText, active && styles.tierChipTextActive]}>{tier}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.chipRow}>
                {CYCLE_OPTIONS.map((cycle) => {
                  const active = draftCycle === cycle;
                  return (
                    <Pressable key={cycle} onPress={() => setDraftCycle(cycle)} style={[styles.tierChip, active && styles.tierChipActive]}>
                      <Text style={[styles.tierChipText, active && styles.tierChipTextActive]}>{cycle}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput placeholder="Plan name" placeholderTextColor={Colors.textDisabled} value={draftName} onChangeText={setDraftName} style={styles.inputPlain} />
              <TextInput placeholder="Description" placeholderTextColor={Colors.textDisabled} value={draftDesc} onChangeText={setDraftDesc} style={styles.inputPlain} />
              <View style={styles.inputsRow}>
                <View style={styles.inputCell}>
                  <Text style={styles.label}>Base price</Text>
                  <TextInput value={draftBase} onChangeText={setDraftBase} keyboardType="numeric" style={styles.inputPlain} />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.label}>Offer %</Text>
                  <TextInput value={draftOffer} onChangeText={setDraftOffer} keyboardType="numeric" style={styles.inputPlain} />
                </View>
              </View>
              <View style={styles.inputsRow}>
                <View style={styles.inputCell}>
                  <Text style={styles.label}>Special %</Text>
                  <TextInput value={draftSpecial} onChangeText={setDraftSpecial} keyboardType="numeric" style={styles.inputPlain} />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.label}>Group %</Text>
                  <TextInput value={draftGroup} onChangeText={setDraftGroup} keyboardType="numeric" style={styles.inputPlain} />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.label}>Threshold</Text>
                  <TextInput value={draftThreshold} onChangeText={setDraftThreshold} keyboardType="numeric" style={styles.inputPlain} />
                </View>
              </View>
              <Pressable disabled={creating} style={[styles.createBtn, creating && { opacity: 0.6 }]} onPress={handleCreatePlan}>
                <PackagePlus size={14} color="#FFFFFF" />
                <Text style={styles.createBtnText}>{creating ? 'Creating…' : 'Create Plan'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
    ...Shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: Colors.text },
  helperText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  orgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  orgChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: Colors.surfaceAlt,
  },
  orgChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  orgChipText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  orgChipTextActive: { color: Colors.primary },
  orgChipSub: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  orgChipSubActive: { color: Colors.primary },
  currentPlanCard: { borderColor: Colors.primary },
  currentPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currentPlanMeta: { flex: 1, gap: 2 },
  currentPlanName: { fontSize: 16, fontWeight: '900', color: Colors.text },
  currentPlanSub: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  tierBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputsRow: { flexDirection: 'row', gap: 10 },
  inputCell: { flex: 1, gap: 4 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 13, color: Colors.text },
  inputPlain: {
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.text,
  },
  plansGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  planCellWrap: { flexGrow: 1, flexBasis: 260, minWidth: 220 },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtnText: { fontSize: 11, fontWeight: '800' },
  loadingBox: { paddingVertical: 18, alignItems: 'center' },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.successLight, padding: 10, borderRadius: Radius.md },
  infoText: { color: Colors.success, fontSize: 12, fontWeight: '700', flex: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorLight, padding: 10, borderRadius: Radius.md },
  errorText: { color: Colors.error, fontSize: 12, fontWeight: '700', flex: 1 },
  collapseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapseToggle: { fontSize: 16, fontWeight: '900', color: Colors.primary },
  createForm: { gap: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tierChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  tierChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  tierChipText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'capitalize' },
  tierChipTextActive: { color: Colors.primary },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12,
  },
  createBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
});
