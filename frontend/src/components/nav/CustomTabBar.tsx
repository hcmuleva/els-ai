import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { Link } from 'expo-router';
import { MoreHorizontal } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useAuth } from '../../context/AuthContext';
import { roleTabs } from '../../config/roleTabs';
import { Colors, RoleColors } from '../../theme';

// ── Config ────────────────────────────────────────────────────────────────────
const TAB_COLORS: Record<string, string> = {
  index:         RoleColors.student,
  classroom:     RoleColors.teacher,
  reports:       RoleColors.admin,
  planner:       RoleColors.student,
  exam:          RoleColors.teacher,
  logicopiccolo: RoleColors.parent,
  manage:        RoleColors.superadmin,
  assessment:    RoleColors.admin,
  evaluation:    RoleColors.student,
  admin:         RoleColors.teacher,
  practice:      RoleColors.parent,
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
        <Icon size={18} color={active ? '#fff' : '#525C6B'} strokeWidth={2} />
      </View>
      <Text style={[s.moreLabel, active && { color, fontWeight: '800' }]}>{label}</Text>
      {active && <View style={[s.moreDot, { backgroundColor: color }]} />}
    </Pressable>
  );
}

// ── CustomTabBar ──────────────────────────────────────────────────────────────
export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
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
    ? (TAB_COLORS[activeRouteName] ?? '#2D5DC9')
    : overflowActive
      ? '#525C6B'
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

  // Real anchor href for each route, so the primary tabs render as genuine
  // <a> elements on web (via Link asChild) instead of relying solely on
  // Pressable's pointer-responder press detection for activation.
  const hrefFor = (routeName: string) => (routeName === 'index' ? '/(tabs)' : `/(tabs)/${routeName}`);

  // Allow screens to hide the tab bar via options.tabBarStyle = { display: 'none' }.
  const focusedKey = state.routes[state.index]?.key;
  const focusedTabBarStyle = focusedKey ? (descriptors[focusedKey]?.options?.tabBarStyle as { display?: string } | undefined) : undefined;
  if (focusedTabBarStyle?.display === 'none') return null;

  return (
    <View style={[s.safeArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* ── More panel modal ── */}
      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable style={s.moreBackdrop} onPress={() => setMoreOpen(false)}>
          <View style={[s.morePanel, { paddingBottom: Math.max(insets.bottom, 20) }]} onStartShouldSetResponder={() => true}>
            <View style={s.morePanelHandle} />
            <Text style={s.morePanelTitle}>All Tabs</Text>
            {visibleTabs.map((route) => {
              const roleTab = roleTabs[activeRole]?.find((r) => r.route === route.name);
              const label   = roleTab?.label ?? descriptors[route.key]?.options?.title ?? route.name;
              const IconC   = roleTab?.icon as React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | undefined;
              const color   = TAB_COLORS[route.name] ?? '#2D5DC9';
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
              <Link key={route.key} href={hrefFor(route.name) as any} asChild>
                <Pressable
                  onPress={() => navigate(route)}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                  style={s.fixedSlot}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <IconC size={ICON_SIZE} color={isFocused ? '#fff' : '#525C6B'} strokeWidth={isFocused ? 2.5 : 2} />
                  <Text style={[s.slotLabel, isFocused ? s.slotLabelActive : s.slotLabelInactive]} numberOfLines={1}>{label}</Text>
                </Pressable>
              </Link>
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
              <MoreHorizontal size={ICON_SIZE} color={overflowActive ? '#fff' : '#525C6B'} strokeWidth={2} />
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
    backgroundColor: Colors.surface,
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 16,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
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
    color: Colors.surface,
  },
  slotLabelInactive: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  // ── More panel ──
  moreBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  morePanel: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: Colors.text,
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
    color: Colors.textMuted,
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
    color: Colors.text,
  },
  moreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
