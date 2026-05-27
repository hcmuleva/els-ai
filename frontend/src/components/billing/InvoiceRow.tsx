import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, CreditCard, Download, FileDown, FileText, Hash, Receipt } from 'lucide-react-native';

import { Colors, Radius, Shadow } from '../../theme';
import { Invoice, formatCurrency, formatDate } from '../../utils/billing';
import { StatusBadge } from './StatusBadge';

type Props = {
  invoice: Invoice;
  onPay?: () => void;
  onExport?: () => void;
  onPreview?: () => void;
  paying?: boolean;
  showOrgName?: boolean;
};

export function InvoiceRow({ invoice, onPay, onExport, onPreview, paying, showOrgName }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Receipt size={18} color={Colors.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.invoiceNumber} numberOfLines={1}>
              <Hash size={11} color={Colors.textMuted} /> {invoice.invoiceNumber}
            </Text>
            <Text style={styles.planText} numberOfLines={1}>
              {invoice.planName || 'Subscription'} · {(invoice.membershipTier || '').toUpperCase()} · {(invoice.billingCycle || '').toUpperCase()}
            </Text>
          </View>
          <StatusBadge status={invoice.status} />
        </View>
        {showOrgName && invoice.organizationName ? (
          <Text style={styles.orgText} numberOfLines={1}>
            <FileText size={11} color={Colors.textMuted} /> {invoice.organizationName}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <CalendarClock size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>Issued {formatDate(invoice.issuedAt)}</Text>
          </View>
          <View style={styles.metaCell}>
            <CreditCard size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>Due {formatDate(invoice.dueAt)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.amount}>{formatCurrency(invoice.amountDue, invoice.currency)}</Text>
          </View>
        </View>
        <View style={styles.actions}>
          {invoice.status === 'pending' && onPay ? (
            <Pressable style={[styles.payBtn, paying && { opacity: 0.6 }]} disabled={paying} onPress={onPay}>
              <CreditCard size={13} color="#FFFFFF" />
              <Text style={styles.payBtnText}>{paying ? 'Processing…' : 'Pay Now'}</Text>
            </Pressable>
          ) : null}
          {onPreview ? (
            <Pressable style={styles.ghostBtn} onPress={onPreview}>
              <FileText size={13} color={Colors.primary} />
              <Text style={styles.ghostBtnText}>Preview</Text>
            </Pressable>
          ) : null}
          {onExport ? (
            <Pressable style={styles.ghostBtn} onPress={onExport}>
              <FileDown size={13} color={Colors.primary} />
              <Text style={styles.ghostBtnText}>Export PDF</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    ...Shadow.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleBlock: { flex: 1, gap: 2 },
  invoiceNumber: { fontSize: 12, fontWeight: '800', color: Colors.text },
  planText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  orgText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: Colors.textSecondary },
  amount: { fontSize: 13, fontWeight: '900', color: Colors.text },
  actions: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
  },
  payBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
  },
  ghostBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
});
