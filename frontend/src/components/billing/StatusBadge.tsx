import { StyleSheet, Text, View } from 'react-native';
import { InvoiceStatus, statusColor } from '../../utils/billing';

export function StatusBadge({ status, size = 'sm' }: { status: InvoiceStatus; size?: 'sm' | 'md' }) {
  const palette = statusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.text, { color: palette.fg }, size === 'md' && styles.textMd]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeMd: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  textMd: {
    fontSize: 11,
  },
});
