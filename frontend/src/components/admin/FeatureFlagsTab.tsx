/**
 * Admin "Feature Flags" panel — the P2 "Telemetry/crash reporting and
 * feature flags infrastructure" backlog item, scoped down to just feature
 * flags per explicit decision (see PENDING_ITEMS.md #11): no crash
 * reporting or usage telemetry was requested this round.
 *
 * Lists every flag in the server-side registry
 * (backend/core-api/src/services/featureFlags/registry.ts) and lets an
 * admin toggle it on/off for their own organization via
 * `PATCH /feature-flags/:key`. Reads through the shared
 * `useFeatureFlags()` hook so toggling here immediately updates every
 * other screen reading the same flag (e.g. the Analytics tab's own
 * visibility, gated via `useFeatureFlag('admin_school_analytics')` in
 * admin.tsx) without a full reload.
 */
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { Flag } from 'lucide-react-native';

import { Colors, Radius, Shadow } from '../../theme';
import { useFeatureFlags, type FeatureFlag } from '../../hooks/useFeatureFlags';

type Props = {
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
};

export function FeatureFlagsTab({ apiFetch }: Props) {
  const { data: flags, isLoading, error, refetch } = useFeatureFlags();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState('');

  const handleToggle = async (flag: FeatureFlag, next: boolean) => {
    setPendingKey(flag.key);
    setToggleError('');
    try {
      const res = await apiFetch(`/feature-flags/${flag.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error('Failed to update flag');
      await refetch();
    } catch (e) {
      setToggleError(e instanceof Error ? e.message : 'Failed to update flag');
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={[s.headerIcon, { backgroundColor: Colors.primaryLight }]}>
          <Flag size={18} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Feature Flags</Text>
          <Text style={s.cardHint}>
            Turn features on or off for your organization. Changes apply immediately, no deploy needed.
          </Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator accessibilityLabel="Loading feature flags" size="small" color={Colors.primary} />
      ) : error ? (
        <Text style={s.emptyText}>{error instanceof Error ? error.message : 'Failed to load feature flags'}</Text>
      ) : !flags || flags.length === 0 ? (
        <Text style={s.emptyText}>No feature flags are registered yet.</Text>
      ) : (
        <View style={{ gap: 4 }}>
          {flags.map((flag) => (
            <View key={flag.key} style={s.row}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={s.rowLabel}>{flag.label}</Text>
                <Text style={s.rowDescription}>{flag.description}</Text>
              </View>
              {pendingKey === flag.key ? (
                <ActivityIndicator accessibilityLabel={`Updating ${flag.label}`} size="small" color={Colors.primary} />
              ) : (
                <Switch
                  value={flag.enabled}
                  onValueChange={(next) => handleToggle(flag, next)}
                  trackColor={{ false: '#E8EAF0', true: Colors.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E8EAF0"
                  accessibilityLabel={flag.label}
                  accessibilityHint={flag.description}
                />
              )}
            </View>
          ))}
        </View>
      )}

      {toggleError ? <Text style={s.errorText}>{toggleError}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.xl,
    padding: 16,
    gap: 12,
    ...Shadow.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  cardHint: { fontSize: 12, color: Colors.textMuted, lineHeight: 17, fontWeight: '500' },
  emptyText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600', paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  rowLabel: { fontSize: 14, fontWeight: '800', color: Colors.text },
  rowDescription: { fontSize: 12, color: Colors.textMuted, lineHeight: 16, fontWeight: '500', marginTop: 2 },
  errorText: { fontSize: 12, color: '#B71C1C', fontWeight: '700' },
});

export default FeatureFlagsTab;
