import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { MoreHorizontal } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useAuth } from '../../context/AuthContext';
import { roleTabs } from '../../config/roleTabs';

// ── Config ────────────────────────────────────────────────────────────────────
const TAB_COLORS: Record<string, string> = {
  index:         '#4A90E2',
  classroom:     '#FF7043',
  reports:       '#9B8EC4',
  planner:       '#4A90E2',
  exam:          '#FF7043',
  logicopiccolo: '#7DC67A',
  manage:        '#E6A817',
  assessment:    '#9B8EC4',
  evaluation:    '#4A90E2',
  admin:         '#FF7043',
  practice:      '#7DC67A',
};

const SLOT_H     = 52;
const ICON_SIZE  = 20;
const BAR_H_PAD  = 12;
const BAR_V_PAD  = 6;
const PILL_INSET = 6;
// Max tabs shown inline (not counting the More button)
const MAX_INLINE = 3;

// ── More panel item ───────────────────────────────────────────────────────────
function MoreItem({
  label, icon: Icon, active, color, onPress,
}: {
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[s.moreRow, active && { backgroundColor: `${color}15` }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[s.moreIconBox, active && { backgroundColor: color }]}>
        <Icon size={18} color={active ? '#fff' : '#9A9AB0'} strokeWidth={2} />
      </View>
      <Text style={[s.moreLabel, active && { color, fontWeight: '800' }]}>{label}</Text>
      {active && <View style={[s.moreDot, { backgroundColor: color }]} />}
    </Pressable>
  );
}

// ── CustomTabBar ──────────────────────────────────────────────────────────────
export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { user }   = useAuth();
  const activeRole = user?.activeRole ?? 'student';
  const visibleRoutes = new Set(roleTabs[activeRole]?.map((r) => r.route) ?? []);

  const [barWidth, setBarWidth] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleTabs     = state.routes.filter((r) => visibleRoutes.has(r.name));
  const activeRouteName = state.routes[state.index]?.name ?? '';
  const activeVisibleIndex = visibleTabs.findIndex((r) => r.name === activeRouteName);
  const activeInVisibleTabs = activeVisibleIndex >= 0;

  // Split: primary tabs (inline) vs overflow (in More panel)
  const hasMore     = visibleTabs.length > MAX_INLINE;
  const primaryTabs = hasMore ? visibleTabs.slice(0, MAX_INLINE) : visibleTabs;
  // Total slots = primary tabs + (More button if needed)
  const slotCount   = primaryTabs.length + (hasMore ? 1 : 0);

  // Is the active route one of the primary tabs?
  const primaryIndex = primaryTabs.findIndex((r) => r.name === activeRouteName);
  // If active is an overflow tab, highlight More slot; if active route isn't in visible tabs, show no active slot.
  const overflowActive = hasMore && activeInVisibleTabs && primaryIndex < 0;
  const activeSlotIndex = primaryIndex >= 0 ? primaryIndex : (overflowActive ? slotCount - 1 : -1);
  const activeColor = primaryIndex >= 0
    ? (TAB_COLORS[activeRouteName] ?? '#4A90E2')
    : overflowActive
      ? '#9A9AB0'
      : 'transparent';

  const contentW = Math.max(barWidth - BAR_H_PAD * 2, 0);
  const slotW    = slotCount > 0 ? contentW / slotCount : 0;

  const slideX = useSharedValue(0);
  const pillW  = useSharedValue(0);

  useEffect(() => {
    if (barWidth === 0 || slotCount === 0) return;
    const targetX = activeSlotIndex >= 0
      ? BAR_H_PAD + activeSlotIndex * slotW + PILL_INSET
      : BAR_H_PAD + PILL_INSET;
    const pw = activeSlotIndex >= 0 ? Math.max(slotW - PILL_INSET * 2, 0) : 0;
    slideX.value = withTiming(targetX, { duration: 250, easing: Easing.out(Easing.cubic) });
    pillW.value  = withTiming(pw,      { duration: 230, easing: Easing.out(Easing.cubic) });
  }, [activeSlotIndex, slotW, barWidth, slotCount]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    width: pillW.value,
  }));

  const onBarLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  const navigate = (route: typeof visibleTabs[0]) => {
    setMoreOpen(false);
    const isFocused = route.name === activeRouteName;
    const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocused && !ev.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View style={s.safeArea}>
      {/* ── More panel modal ── */}
      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable style={s.moreBackdrop} onPress={() => setMoreOpen(false)}>
          <View style={s.morePanel} onStartShouldSetResponder={() => true}>
            <View style={s.morePanelHandle} />
            <Text style={s.morePanelTitle}>All Tabs</Text>
            {visibleTabs.map((route) => {
              const roleTab = roleTabs[activeRole]?.find((r) => r.route === route.name);
              const label   = roleTab?.label ?? descriptors[route.key]?.options?.title ?? route.name;
              const IconC   = roleTab?.icon as React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | undefined;
              const color   = TAB_COLORS[route.name] ?? '#4A90E2';
              if (!IconC) return null;
              return (
                <MoreItem
                  key={route.key}
                  label={label}
                  icon={IconC}
                  active={route.name === activeRouteName}
                  color={color}
                  onPress={() => navigate(route)}
                />
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* ── Tab bar ── */}
      <View style={s.barOuter} onLayout={onBarLayout}>
        {/* Sliding pill */}
        <Animated.View
          style={[s.pill, { backgroundColor: activeColor, top: BAR_V_PAD, height: SLOT_H }, pillStyle]}
          pointerEvents="none"
        />

        <View style={s.fixedRow}>
          {/* Primary inline tabs */}
          {primaryTabs.map((route) => {
            const isFocused = route.name === activeRouteName;
            const roleTab   = roleTabs[activeRole]?.find((r) => r.route === route.name);
            const label     = roleTab?.label ?? descriptors[route.key]?.options?.title ?? route.name;
            const IconC     = roleTab?.icon as React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | undefined;
            if (!IconC) return null;
            return (
              <Pressable
                key={route.key}
                onPress={() => navigate(route)}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                style={s.fixedSlot}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <IconC size={ICON_SIZE} color={isFocused ? '#fff' : '#9A9AB0'} strokeWidth={isFocused ? 2.5 : 2} />
                <Text style={[s.slotLabel, isFocused ? s.slotLabelActive : s.slotLabelInactive]} numberOfLines={1}>{label}</Text>
              </Pressable>
            );
          })}

          {/* More button */}
          {hasMore && (
            <Pressable
              style={s.fixedSlot}
              onPress={() => setMoreOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="More"
            >
              <MoreHorizontal size={ICON_SIZE} color={overflowActive ? '#fff' : '#9A9AB0'} strokeWidth={2} />
              <Text style={[s.slotLabel, overflowActive ? s.slotLabelActive : s.slotLabelInactive]}>More</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    paddingBottom: Platform.OS === 'ios' ? 26 : 8,
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 16,
    borderTopWidth: 1,
    borderColor: '#F0F0F8',
  },
  barOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: BAR_V_PAD,
    position: 'relative',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    borderRadius: 999,
    zIndex: 0,
    left: 0,
  },
  fixedRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: BAR_H_PAD,
  },
  fixedSlot: {
    flex: 1,
    height: SLOT_H,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 1,
  },
  slotLabel: {
    includeFontPadding: false,
    letterSpacing: 0.1,
  },
  slotLabelActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  slotLabelInactive: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9A9AB0',
  },
  // ── More panel ──
  moreBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  morePanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingHorizontal: 20,
    shadowColor: '#1a1a2e',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 24,
  },
  morePanelHandle: {
    width: 36, height: 4,
    backgroundColor: '#E0E0EE',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 14,
  },
  morePanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9A9AB0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingLeft: 4,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 4,
  },
  moreIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F4F4FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  moreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
