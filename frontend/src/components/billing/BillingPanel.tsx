import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock,
  FileDown,
  Filter,
  Hourglass,
  RefreshCw,
  Search,
  Wallet,
  XCircle,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { Colors, Radius, Shadow } from '../../theme';
import { Invoice, InvoiceStatus, exportInvoice, formatCurrency, formatDate } from '../../utils/billing';
import { InvoiceRow } from './InvoiceRow';
import { PaymentGatewayModal } from './PaymentGatewayModal';

type Organization = { id: string; name: string; subdomain: string };

type Subscription = {
  id?: string;
  status?: string;
  plan_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  trial_end_at?: string | null;
  final_price?: number | null;
  seat_count?: number | null;
};

const STATUS_FILTERS: Array<{ key: 'all' | InvoiceStatus; label: string; icon: any }> = [
  { key: 'all',       label: 'All',       icon: Filter        },
  { key: 'pending',   label: 'Pending',   icon: Clock         },
  { key: 'paid',      label: 'Paid',      icon: CheckCircle2  },
  { key: 'expired',   label: 'Expired',   icon: AlertTriangle },
  { key: 'renewed',   label: 'Renewed',   icon: RefreshCw     },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle       },
];

type Props = {
  mode: 'superadmin' | 'admin';
  organizations: Organization[];
  currentOrganizationId?: string;
  selectedOrgId: string;
  onSelectOrg?: (id: string) => void;
};

export function BillingPanel({ mode, organizations, currentOrganizationId, selectedOrgId, onSelectOrg }: Props) {
  const { apiFetch } = useAuth();
  const isSuper = mode === 'superadmin';

  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string>('');
  const [renewing, setRenewing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const activeOrgId = isSuper ? selectedOrgId : currentOrganizationId || selectedOrgId;
  const activeOrg = useMemo(
    () => organizations.find((org) => org.id === activeOrgId) || null,
    [organizations, activeOrgId],
  );

  const loadInvoices = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    setError('');
    try {
      const params = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const response = await apiFetch(`/billing/organizations/${activeOrgId}/invoices${params}`);
      if (!response.ok) throw new Error('Failed to load invoices');
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, activeOrgId, statusFilter]);

  const loadSubscription = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const response = await apiFetch(`/billing/organizations/${activeOrgId}/subscription`);
      if (!response.ok) return;
      const data = await response.json();
      setSubscription((data.subscription || null) as Subscription | null);
    } catch (_e) { /* ignore */ }
  }, [apiFetch, activeOrgId]);

  const loadPending = useCallback(async () => {
    if (!isSuper) return;
    try {
      const response = await apiFetch(`/billing/invoices/pending?limit=25`);
      if (!response.ok) return;
      const data = await response.json();
      setPendingInvoices(data.invoices || []);
    } catch (_e) { /* ignore */ }
  }, [apiFetch, isSuper]);

  useEffect(() => {
    loadInvoices();
    loadSubscription();
  }, [loadInvoices, loadSubscription]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const triggerPay = (invoice: Invoice) => {
    setError('');
    setInfo('');
    setActiveInvoice(invoice);
  };

  const confirmPay = async (paymentMethod: string, paymentReference: string) => {
    if (!activeInvoice) return;
    setPayingInvoiceId(activeInvoice.id);
    try {
      const response = await apiFetch(`/billing/invoices/${activeInvoice.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod, paymentReference }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Payment failed');
      }
      setInfo(`Invoice ${activeInvoice.invoiceNumber} marked as paid.`);
      await Promise.all([loadInvoices(), loadSubscription(), loadPending()]);
    } finally {
      setPayingInvoiceId('');
    }
  };

  const handleExport = (invoice: Invoice) => {
    const result = exportInvoice(invoice, activeOrg?.name);
    setInfo(result.message);
  };

  const handleRenew = async () => {
    if (!activeOrgId) return;
    setRenewing(true);
    setError('');
    setInfo('');
    try {
      const response = await apiFetch(`/billing/organizations/${activeOrgId}/renew`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Renewal failed');
      }
      setInfo('Subscription renewed. A new invoice has been issued.');
      await Promise.all([loadInvoices(), loadSubscription(), loadPending()]);
    } catch (e: any) {
      setError(e?.message || 'Renewal failed');
    } finally {
      setRenewing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!activeOrgId) return;
    setDeactivating(true);
    setError('');
    setInfo('');
    try {
      const response = await apiFetch(`/billing/organizations/${activeOrgId}/deactivate`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Deactivation failed');
      }
      setInfo('Subscription deactivated. Pending invoices were cancelled.');
      await Promise.all([loadInvoices(), loadSubscription(), loadPending()]);
    } catch (e: any) {
      setError(e?.message || 'Deactivation failed');
    } finally {
      setDeactivating(false);
    }
  };

  const summary = useMemo(() => {
    let pending = 0;
    let paid = 0;
    let pendingAmount = 0;
    let paidAmount = 0;
    invoices.forEach((inv) => {
      if (inv.status === 'pending') {
        pending += 1;
        pendingAmount += inv.amountDue;
      } else if (inv.status === 'paid') {
        paid += 1;
        paidAmount += inv.amountDue;
      }
    });
    return { pending, paid, pendingAmount, paidAmount };
  }, [invoices]);

  const subStatusColor = (status?: string) => {
    if (!status) return Colors.textMuted;
    if (status === 'active') return Colors.success;
    if (status === 'trialing') return Colors.accent;
    if (status === 'past_due') return Colors.warning;
    return Colors.error;
  };

  return (
    <View style={styles.root}>
      {isSuper ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Wallet size={16} color={Colors.primary} />
            <Text style={styles.cardTitle}>Organization</Text>
          </View>
          <Text style={styles.helperText}>Select an organization to manage its billing & invoices.</Text>
          <View style={styles.orgGrid}>
            {organizations.map((org) => {
              const active = selectedOrgId === org.id;
              return (
                <Pressable
                  key={org.id}
                  onPress={() => onSelectOrg && onSelectOrg(org.id)}
                  style={[styles.orgChip, active && styles.orgChipActive]}
                >
                  <CircleDot size={11} color={active ? Colors.primary : Colors.textMuted} />
                  <Text style={[styles.orgChipText, active && styles.orgChipTextActive]} numberOfLines={1}>
                    {org.name}
                  </Text>
                  <Text style={[styles.orgChipSub, active && styles.orgChipSubActive]} numberOfLines={1}>
                    {org.subdomain}
                  </Text>
                </Pressable>
              );
            })}
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

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: Colors.primaryLight }]}>
          <View style={[styles.statIcon, { backgroundColor: Colors.primaryLight }]}>
            <Hourglass size={14} color={Colors.primary} />
          </View>
          <Text style={styles.statValue}>{summary.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statAmount}>{formatCurrency(summary.pendingAmount)}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.successLight }]}>
          <View style={[styles.statIcon, { backgroundColor: Colors.successLight }]}>
            <CheckCircle2 size={14} color={Colors.success} />
          </View>
          <Text style={styles.statValue}>{summary.paid}</Text>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={styles.statAmount}>{formatCurrency(summary.paidAmount)}</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.accentLight }]}>
          <View style={[styles.statIcon, { backgroundColor: Colors.accentLight }]}>
            <CalendarClock size={14} color={Colors.accent} />
          </View>
          <Text style={styles.statValue}>
            {subscription?.status ? (subscription.status as string).toUpperCase() : '—'}
          </Text>
          <Text style={styles.statLabel}>Status</Text>
          <Text style={[styles.statAmount, { color: subStatusColor(subscription?.status) }]}>
            {subscription?.ends_at
              ? `Renews ${formatDate(subscription.ends_at)}`
              : subscription?.trial_end_at
                ? `Trial ends ${formatDate(subscription.trial_end_at)}`
                : '—'}
          </Text>
        </View>
      </View>

      {isSuper && pendingInvoices.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Clock size={16} color={Colors.warning} />
            <Text style={styles.cardTitle}>Pending Payments Across Orgs</Text>
            <View style={[styles.pill, { backgroundColor: Colors.warningLight }]}>
              <Text style={[styles.pillText, { color: Colors.warning }]}>{pendingInvoices.length}</Text>
            </View>
          </View>
          <View style={styles.invoiceList}>
            {pendingInvoices.slice(0, 4).map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                showOrgName
                onPay={() => triggerPay(inv)}
                onExport={() => handleExport(inv)}
                onPreview={() => handleExport(inv)}
                paying={payingInvoiceId === inv.id}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Search size={16} color={Colors.primary} />
          <Text style={styles.cardTitle}>
            Payment History {activeOrg ? `· ${activeOrg.name}` : ''}
          </Text>
          <Pressable onPress={loadInvoices} hitSlop={8} style={styles.refreshBtn}>
            <RefreshCw size={13} color={Colors.primary} />
          </Pressable>
        </View>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((opt) => {
            const Icon = opt.icon;
            const active = statusFilter === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setStatusFilter(opt.key)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Icon size={12} color={active ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        ) : invoices.length === 0 ? (
          <View style={styles.emptyBox}>
            <FileDown size={20} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No invoices match the current filter.</Text>
          </View>
        ) : (
          <View style={styles.invoiceList}>
            {invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                onPay={() => triggerPay(inv)}
                onExport={() => handleExport(inv)}
                onPreview={() => handleExport(inv)}
                paying={payingInvoiceId === inv.id}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <RefreshCw size={16} color={Colors.primary} />
          <Text style={styles.cardTitle}>Subscription Actions</Text>
        </View>
        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleRenew}
            disabled={renewing || !activeOrgId}
            style={[styles.actionBtn, (renewing || !activeOrgId) && { opacity: 0.6 }]}
          >
            <RefreshCw size={14} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>{renewing ? 'Renewing…' : 'Renew Plan'}</Text>
          </Pressable>
          <Pressable
            onPress={handleDeactivate}
            disabled={deactivating || !activeOrgId}
            style={[styles.actionBtnDanger, (deactivating || !activeOrgId) && { opacity: 0.6 }]}
          >
            <XCircle size={14} color={Colors.error} />
            <Text style={styles.actionBtnDangerText}>{deactivating ? 'Deactivating…' : 'Deactivate'}</Text>
          </Pressable>
        </View>
      </View>

      <PaymentGatewayModal
        visible={!!activeInvoice}
        invoice={activeInvoice}
        onClose={() => setActiveInvoice(null)}
        onConfirm={confirmPay}
      />
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
  refreshBtn: {
    width: 28, height: 28, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
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
  statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statCard: {
    flex: 1, minWidth: 140,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg, borderWidth: 1,
    padding: 14, gap: 6,
    ...Shadow.sm,
  },
  statIcon: { width: 30, height: 30, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '900', color: Colors.text },
  statLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  statAmount: { fontSize: 11, fontWeight: '700', color: Colors.text },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: Colors.surfaceAlt, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  filterChipText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'capitalize' },
  filterChipTextActive: { color: Colors.primary },
  invoiceList: { gap: 8 },
  loadingBox: { paddingVertical: 18, alignItems: 'center' },
  emptyBox: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 24,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
  },
  emptyText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  actionBtnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.errorLight, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.error,
  },
  actionBtnDangerText: { color: Colors.error, fontWeight: '800', fontSize: 12 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.successLight, padding: 10, borderRadius: Radius.md,
  },
  infoText: { color: Colors.success, fontSize: 12, fontWeight: '700', flex: 1 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.errorLight, padding: 10, borderRadius: Radius.md,
  },
  errorText: { color: Colors.error, fontSize: 12, fontWeight: '700', flex: 1 },
});
