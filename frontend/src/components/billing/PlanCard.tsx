import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Crown, Sparkles, Star, Shield } from 'lucide-react-native';

import { Colors, Radius, Shadow } from '../../theme';
import { formatCurrency, SubscriptionPlan, tierTheme } from '../../utils/billing';

type Props = {
  plan: SubscriptionPlan;
  selected?: boolean;
  recommended?: boolean;
  onSelect?: () => void;
  onAssign?: () => void;
  assigning?: boolean;
  rightAction?: React.ReactNode;
  features?: string[];
};

const TIER_ICON = {
  bronze: Star,
  silver: Shield,
  gold: Crown,
  platinum: Sparkles,
} as const;

export function PlanCard({ plan, selected, recommended, onSelect, onAssign, assigning, rightAction, features }: Props) {
  const theme = tierTheme(plan.membershipTier);
  const Icon = TIER_ICON[plan.membershipTier] || Star;
  const totalDiscount = Math.min(
    plan.offerDiscountPercent + plan.specialDiscountPercent + plan.groupDiscountPercent,
    90,
  );
  const effectivePrice = plan.basePrice * (1 - totalDiscount / 100);
  const bullets = features && features.length > 0 ? features : [
    `${plan.maxUsersForGroupDiscount}+ users qualify for group discount`,
    `Offer save up to ${plan.offerDiscountPercent}%`,
    `Special discount ${plan.specialDiscountPercent}%`,
    plan.description || 'All core ELS · AI features included',
  ];

  return (
    <Pressable
      onPress={onSelect}
      style={[styles.card, { borderColor: selected ? theme.accent : Colors.border }, selected && styles.cardSelected]}
    >
      <View style={[styles.banner, { backgroundColor: theme.from }]} >
        <View style={[styles.iconWrap, { backgroundColor: theme.accent + '22' }]}>
          <Icon size={20} color={theme.accent} />
        </View>
        <View style={styles.bannerMeta}>
          <Text style={[styles.tierLabel, { color: theme.accent }]}>{theme.label}</Text>
          <Text style={styles.planName}>{plan.name}</Text>
        </View>
        {recommended ? (
          <View style={[styles.recommended, { backgroundColor: theme.accent }]}>
            <Text style={styles.recommendedText}>Recommended</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text style={styles.priceMain}>{formatCurrency(effectivePrice)}</Text>
          <Text style={styles.priceCycle}>/ {plan.billingCycle}</Text>
        </View>
        {totalDiscount > 0 ? (
          <Text style={styles.discountText}>
            <Text style={styles.strikePrice}>{formatCurrency(plan.basePrice)}</Text>
            {'  '}save {totalDiscount.toFixed(0)}%
          </Text>
        ) : null}

        <View style={styles.featureList}>
          {bullets.slice(0, 4).map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={[styles.featureDot, { backgroundColor: theme.accent + '20' }]}>
                <Check size={11} color={theme.accent} />
              </View>
              <Text style={styles.featureText} numberOfLines={2}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {onAssign ? (
            <Pressable
              disabled={assigning}
              onPress={onAssign}
              style={[styles.primaryButton, { backgroundColor: theme.accent }, assigning && { opacity: 0.6 }]}
            >
              <Text style={styles.primaryButtonText}>{assigning ? 'Activating…' : 'Apply Plan'}</Text>
            </Pressable>
          ) : null}
          {rightAction}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...Shadow.md,
  },
  cardSelected: {
    transform: [{ translateY: -2 }],
    ...Shadow.lg,
  },
  banner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerMeta: { flex: 1 },
  tierLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  planName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  recommended: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  recommendedText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  body: { padding: 16, gap: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end' },
  priceMain: { fontSize: 26, fontWeight: '900', color: Colors.text },
  priceCycle: { fontSize: 12, color: Colors.textMuted, marginLeft: 6, marginBottom: 5 },
  discountText: { fontSize: 11, color: Colors.success, fontWeight: '700' },
  strikePrice: { color: Colors.textMuted, textDecorationLine: 'line-through', fontWeight: '600' },
  featureList: { gap: 8, marginTop: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureDot: { width: 18, height: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  primaryButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
});
