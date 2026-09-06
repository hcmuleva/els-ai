import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CreditCard, Lock, ShieldCheck, X, Wallet, IndianRupee } from 'lucide-react-native';

import { Colors, Radius, Shadow } from '../../theme';
import { Invoice, formatCurrency } from '../../utils/billing';

type Props = {
  visible: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onConfirm: (paymentMethod: string, paymentReference: string) => Promise<void> | void;
};

const METHODS: Array<{ key: string; label: string; icon: any; description: string }> = [
  { key: 'cashfree-upi',  label: 'Cashfree UPI',  icon: Wallet,       description: 'Pay via UPI through Cashfree gateway' },
  { key: 'cashfree-card', label: 'Card',          icon: CreditCard,   description: 'Visa, Mastercard, RuPay accepted' },
  { key: 'cashfree-nb',   label: 'Net Banking',   icon: IndianRupee,  description: '40+ Indian banks supported' },
];

export function PaymentGatewayModal({ visible, invoice, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<string>('cashfree-upi');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setMethod('cashfree-upi');
      setReference('');
      setError('');
      setSubmitting(false);
    }
  }, [visible]);

  const handlePay = async () => {
    if (!invoice) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(method, reference.trim() || `PG-MOCK-${Date.now()}`);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Payment failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.brandMark}>
                <ShieldCheck size={16} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Cashfree Gateway</Text>
                <Text style={styles.headerSub}>Sandbox · Secure payment placeholder</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <X size={18} color={Colors.textMuted} />
            </Pressable>
          </View>

          {invoice ? (
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Amount Due</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(invoice.amountDue, invoice.currency)}</Text>
              <Text style={styles.summaryInvoice}>{invoice.invoiceNumber} · {invoice.planName || 'Subscription'}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Choose payment method</Text>
          <View style={styles.methods}>
            {METHODS.map((opt) => {
              const Icon = opt.icon;
              const active = method === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setMethod(opt.key)}
                  style={[styles.method, active && styles.methodActive]}
                >
                  <View style={[styles.methodIcon, active && styles.methodIconActive]}>
                    <Icon size={16} color={active ? '#FFFFFF' : Colors.primary} />
                  </View>
                  <View style={styles.methodBody}>
                    <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>{opt.label}</Text>
                    <Text style={styles.methodSub}>{opt.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Payment reference (optional)</Text>
          <TextInput
            placeholder="e.g. UPI/Cashfree transaction id"
            placeholderTextColor={Colors.textDisabled}
            value={reference}
            onChangeText={setReference}
            style={styles.input}
            autoCapitalize="characters"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable disabled={submitting || !invoice} style={[styles.payBtn, (submitting || !invoice) && { opacity: 0.6 }]} onPress={handlePay}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Lock size={14} color="#FFFFFF" />
                <Text style={styles.payBtnText}>Confirm Payment</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footerNote}>
            <ShieldCheck size={11} color={Colors.success} />
            <Text style={styles.footerText}>
              No live charges. This screen is a placeholder for Cashfree integration.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,28,48,0.55)', justifyContent: 'center', padding: 16 },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 18,
    gap: 12,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
    ...Shadow.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 36, height: 36, borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: Colors.text },
  headerSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  closeBtn: { padding: 4 },
  summary: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    padding: 14,
  },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  summaryAmount: { fontSize: 28, fontWeight: '900', color: Colors.text, marginTop: 2 },
  summaryInvoice: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 2 },
  methods: { gap: 8 },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  methodActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  methodIcon: {
    width: 32, height: 32, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF',
  },
  methodIconActive: { backgroundColor: Colors.primary },
  methodBody: { flex: 1 },
  methodLabel: { fontSize: 13, fontWeight: '800', color: Colors.text },
  methodLabelActive: { color: Colors.primary },
  methodSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: Colors.text,
  },
  error: { color: Colors.error, fontSize: 12, fontWeight: '700' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
  },
  payBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  footerText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
});
