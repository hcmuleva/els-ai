import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const PILL_H     = 46;
const ICON_SIZE  = 20;
const BAR_H_PAD  = 16;
const BAR_V_PAD  = 10;
const MAX_FIXED  = 4;   // at or below this count, fill the bar; above → scroll mode

// ── TabItem ───────────────────────────────────────────────────────────────────
function TabItem({
  label, icon: Icon, active, color, onPress, onLongPress,
}: {
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  active: boolean;
  color: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={s.slot}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={ICON_SIZE} color={active ? '#FFFFFF' : '#9A9AB0'} strokeWidth={active ? 2.5 : 2} />
      {active && (
        <Animated.Text style={s.label} numberOfLines={1}>{label}</Animated.Text>
      )}
    </Pressable>
  );
}

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

  const [barWidth, setBarWidth]  = useState(0);
  const [moreOpen, setMoreOpen]  = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const visibleTabs      = state.routes.filter((r) => visibleRoutes.has(r.name));
  const tabCount         = visibleTabs.length;
  const activeRouteName  = state.routes[state.index]?.name ?? '';
  const activeColor      = TAB_COLORS[activeRouteName] ?? '#4A90E2';

  // Decide fixed vs scroll mode
  const scrollMode = tabCount > MAX_FIXED;

  // In scroll mode: show primary tabs (all) in a horizontal scroll view with fixed slot width
  // In fixed mode: spread evenly across bar width
  const MIN_SLOT_W = 80;

  // For fixed mode pill calculation
  const contentW    = Math.max(barWidth - BAR_H_PAD * 2, 0);
  const fixedSlotW  = tabCount > 0 ? contentW / tabCount : 0;
  const activeVisibleIndex = visibleTabs.findIndex((r) => r.name === activeRouteName);

  // For scroll mode: each slot is MIN_SLOT_W, pill tracks by index
  const scrollSlotW = MIN_SLOT_W;
  const pillWFixed  = fixedSlotW - 8;
  const pillWScroll = scrollSlotW - 10;
  const PILL_W_SML  = PILL_H; // collapsed circle

  const slideX = useSharedValue(0);
  const pillW  = useSharedValue(PILL_W_SML);

  useEffect(() => {
    if (!scrollMode) {
      if (contentW === 0 || tabCount === 0) return;
      const pw = fixedSlotW - 8;
      const targetX = BAR_H_PAD + activeVisibleIndex * fixedSlotW + fixedSlotW / 2 - pw / 2;
      slideX.value = withTiming(targetX, { duration: 260, easing: Easing.out(Easing.cubic) });
      pillW.value  = withTiming(pw, { duration: 240, easing: Easing.out(Easing.cubic) });
    } else {
      const pw = scrollSlotW - 10;
      const targetX = activeVisibleIndex * scrollSlotW + scrollSlotW / 2 - pw / 2;
      slideX.value = withTiming(targetX, { duration: 260, easing: Easing.out(Easing.cubic) });
      pillW.value  = withTiming(pw, { duration: 240, easing: Easing.out(Easing.cubic) });
      // Scroll active tab into view
      const scrollOffset = Math.max(0, activeVisibleIndex * scrollSlotW - (barWidth / 2 - scrollSlotW / 2));
      scrollRef.current?.scrollTo({ x: scrollOffset, animated: true });
    }
  }, [activeVisibleIndex, contentW, tabCount, scrollMode, barWidth]);

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
            <Text style={s.morePanelTitle}>More</Text>
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
      <View style={s.bar} onLayout={onBarLayout}>
        {scrollMode ? (
          /* ─── Scroll mode ─── */
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={[s.scrollContent, { paddingHorizontal: BAR_H_PAD }]}
          >
            {/* Pill inside scroll content */}
            <Animated.View
              style={[s.pill, { backgroundColor: activeColor }, pillStyle]}
              pointerEvents="none"
            />

            {visibleTabs.map((route) => {
              const isFocused = route.name === activeRouteName;
              const roleTab   = roleTabs[activeRole]?.find((r) => r.route === route.name);
              const label     = roleTab?.label ?? descriptors[route.key]?.options?.title ?? route.name;
              const IconC     = roleTab?.icon as React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | undefined;
              const color     = TAB_COLORS[route.name] ?? '#4A90E2';
              if (!IconC) return null;
              return (
                <Pressable
                  key={route.key}
                  onPress={() => navigate(route)}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                  style={[s.scrollSlot, { width: scrollSlotW }]}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <IconC size={ICON_SIZE} color={isFocused ? '#fff' : '#9A9AB0'} strokeWidth={isFocused ? 2.5 : 2} />
                  {isFocused && (
                    <Text style={s.label} numberOfLines={1}>{label}</Text>
                  )}
                </Pressable>
              );
            })}

            {/* "More" / all-tabs button */}
            <Pressable
              style={[s.scrollSlot, { width: scrollSlotW }]}
              onPress={() => setMoreOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="More"
            >
              <MoreHorizontal size={ICON_SIZE} color="#9A9AB0" strokeWidth={2} />
              <Text style={[s.label, { color: '#9A9AB0', fontSize: 11 }]}>All</Text>
            </Pressable>
          </ScrollView>
        ) : (
          /* ─── Fixed mode ─── */
          <>
            <Animated.View
              style={[s.pill, { backgroundColor: activeColor }, pillStyle]}
              pointerEvents="none"
            />
            {visibleTabs.map((route) => {
              const isFocused = route.name === activeRouteName;
              const roleTab   = roleTabs[activeRole]?.find((r) => r.route === route.name);
              const label     = roleTab?.label ?? descriptors[route.key]?.options?.title ?? route.name;
              const IconC     = roleTab?.icon as React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | undefined;
              if (!IconC) return null;
              return (
                <TabItem
                  key={route.key}
                  label={label}
                  icon={IconC}
                  active={isFocused}
                  color={TAB_COLORS[route.name] ?? '#4A90E2'}
                  onPress={() => navigate(route)}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                />
              );
            })}
          </>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
    paddingBottom: Platform.OS === 'ios' ? 26 : 10,
    paddingTop: 2,
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 16,
    borderTopWidth: 1,
    borderColor: '#F0F0F8',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: BAR_V_PAD,
    position: 'relative',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: BAR_V_PAD,
    height: PILL_H,
    borderRadius: 999,
    zIndex: 0,
    left: 0,
  },
  slot: {
    flex: 1,
    height: PILL_H,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    zIndex: 1,
    paddingHorizontal: 6,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    minHeight: PILL_H + BAR_V_PAD * 2,
  },
  scrollSlot: {
    height: PILL_H,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    zIndex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    includeFontPadding: false,
    letterSpacing: 0.2,
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
