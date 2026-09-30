import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { MoreHorizontal } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useAuth } from '../../context/AuthContext';
import { roleTabs } from '../../config/roleTabs';
import { Colors, Radius, RoleColors, Shadow } from '../../theme';
import { ChatButton } from '../chat/ChatButton';

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
  admin:         Colors.primary,
  superadmin:    '#8F680C',
  practice:      RoleColors.parent,
};

const BAR_H_PAD  = 6;
const PILL_INSET = 4;
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
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;
  const slotH     = isDesktop ? 42 : 46;
  const barVPad   = isDesktop ? 4 : 4;
  const iconSize  = isDesktop ? 16 : 18;

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
  // On desktop, show more tabs inline since there is ample horizontal screen width
  const maxInline   = isDesktop ? 6 : MAX_INLINE;
  const hasMore     = visibleTabs.length > maxInline;
  const primaryTabs = hasMore ? visibleTabs.slice(0, maxInline) : visibleTabs;
  // Total slots = primary tabs + (More button if needed)
  const slotCount   = primaryTabs.length + (hasMore ? 1 : 0);

  // Desktop width calculation: comfortable fixed width proportional to slot count
  const desktopBarWidth = Math.min(Math.max(windowWidth - 140, 200), slotCount * 124 + BAR_H_PAD * 2);

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
    if (!isDesktop || barWidth === 0 || slotCount === 0) return;
    const targetX = activeSlotIndex >= 0
      ? BAR_H_PAD + activeSlotIndex * slotW + PILL_INSET
      : BAR_H_PAD + PILL_INSET;
    const pw = activeSlotIndex >= 0 ? Math.max(slotW - PILL_INSET * 2, 0) : 0;
    slideX.value = withTiming(targetX, { duration: 250, easing: Easing.out(Easing.cubic) });
    pillW.value  = withTiming(pw,      { duration: 230, easing: Easing.out(Easing.cubic) });
  }, [activeSlotIndex, slotW, barWidth, slotCount, isDesktop]);

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

  // Allow screens to hide the tab bar via options.tabBarStyle = { display: 'none' }.
  const focusedKey = state.routes[state.index]?.key;
  const focusedTabBarStyle = focusedKey ? (descriptors[focusedKey]?.options?.tabBarStyle as { display?: string } | undefined) : undefined;
  if (focusedTabBarStyle?.display === 'none') return null;

  const renderMoreModal = () => (
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
  );

  // ── MOBILE TAB BAR ─────────────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <View
        style={StyleSheet.flatten([
          s.mobileBarContainer,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ])}
      >
        {renderMoreModal()}

        {slotCount <= 1 ? (
          // Single tab presentation: centered, soft-tinted pill badge — never a screen-wide blob or broken cramped oval
          <View style={s.mobileSingleTabContainer}>
            {primaryTabs.map((route) => {
              const roleTab   = roleTabs[activeRole]?.find((r) => r.route === route.name);
              const label     = roleTab?.label ?? descriptors[route.key]?.options?.title ?? route.name;
              const IconC     = roleTab?.icon as React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | undefined;
              if (!IconC) return null;
              const tabColor  = TAB_COLORS[route.name] ?? Colors.primary;
              return (
                <Pressable
                  key={route.key}
                  onPress={() => navigate(route)}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                  style={StyleSheet.flatten([s.mobileSingleTabPill, { backgroundColor: `${tabColor}14` }])}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <IconC size={18} color={tabColor} strokeWidth={2.5} />
                  <Text style={[s.mobileSingleTabLabel, { color: tabColor }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          // Multi-tab presentation: evenly distributed native bottom navigation bar
          <View style={s.mobileTabsRow}>
            {primaryTabs.map((route) => {
              const isFocused = route.name === activeRouteName;
              const roleTab   = roleTabs[activeRole]?.find((r) => r.route === route.name);
              const label     = roleTab?.label ?? descriptors[route.key]?.options?.title ?? route.name;
              const IconC     = roleTab?.icon as React.ComponentType<{ size: number; color: string; strokeWidth?: number }> | undefined;
              if (!IconC) return null;
              const tabColor  = TAB_COLORS[route.name] ?? Colors.primary;
              return (
                <Pressable
                  key={route.key}
                  onPress={() => navigate(route)}
                  onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                  style={s.mobileTabSlot}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <View style={StyleSheet.flatten([s.mobileIconBox, isFocused ? { backgroundColor: `${tabColor}16` } : undefined])}>
                    <IconC size={20} color={isFocused ? tabColor : '#64748B'} strokeWidth={isFocused ? 2.5 : 2} />
                  </View>
                  <Text
                    style={[
                      s.mobileTabLabel,
                      {
                        color: isFocused ? tabColor : '#64748B',
                        fontWeight: isFocused ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}

            {/* More button */}
            {hasMore && (
              <Pressable
                style={s.mobileTabSlot}
                onPress={() => setMoreOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="More"
              >
                <View style={StyleSheet.flatten([s.mobileIconBox, overflowActive ? { backgroundColor: 'rgba(100, 116, 139, 0.15)' } : undefined])}>
                  <MoreHorizontal size={20} color={overflowActive ? '#1E293B' : '#64748B'} strokeWidth={2} />
                </View>
                <Text
                  style={[
                    s.mobileTabLabel,
                    {
                      color: overflowActive ? '#1E293B' : '#64748B',
                      fontWeight: overflowActive ? '700' : '500',
                    },
                  ]}
                >
                  More
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }

  // ── DESKTOP FLOATING DOCK ──────────────────────────────────────────────────
  const safeAreaStyle = StyleSheet.flatten([
    s.safeArea,
    {
      position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
      bottom: 24,
    },
  ]);

  const barOuterStyle = StyleSheet.flatten([
    s.barOuter,
    {
      paddingVertical: barVPad,
      width: desktopBarWidth,
    },
  ]);

  const slotStyle = StyleSheet.flatten([s.fixedSlot, { height: slotH }]);

  return (
    <View style={safeAreaStyle} pointerEvents="box-none">
      {renderMoreModal()}

      {/* Tab bar dock row (wraps nav capsule + AI button on desktop) */}
      <View style={s.dockRowDesktop} pointerEvents="box-none">
        <View
          style={barOuterStyle}
          onLayout={onBarLayout}
          pointerEvents="auto"
        >
          {/* Sliding pill */}
          <Animated.View
            style={[s.pill, { backgroundColor: activeColor, top: barVPad, height: slotH }, pillStyle]}
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
                  style={slotStyle}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <IconC size={iconSize} color={isFocused ? '#fff' : '#525C6B'} strokeWidth={isFocused ? 2.5 : 2} />
                  <Text
                    style={[
                      s.slotLabel,
                      {
                        fontSize: 12.5,
                        color: isFocused ? '#fff' : '#525C6B',
                        fontWeight: isFocused ? '700' : '600',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}

            {/* More button */}
            {hasMore && (
              <Pressable
                style={slotStyle}
                onPress={() => setMoreOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="More"
              >
                <MoreHorizontal size={iconSize} color={overflowActive ? '#fff' : '#525C6B'} strokeWidth={2} />
                <Text
                  style={[
                    s.slotLabel,
                    {
                      fontSize: 12.5,
                      color: overflowActive ? '#fff' : '#525C6B',
                      fontWeight: overflowActive ? '700' : '600',
                    },
                  ]}
                >
                  More
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <ChatButton isDesktopDock />
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Mobile styles
  mobileBarContainer: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8ECF4',
    paddingTop: 8,
    zIndex: 1000,
    ...Shadow.md,
  },
  mobileTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 8,
  },
  mobileTabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  mobileIconBox: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTabLabel: {
    fontSize: 11,
    includeFontPadding: false,
    letterSpacing: 0.1,
  },
  mobileSingleTabContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  mobileSingleTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  mobileSingleTabLabel: {
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
    letterSpacing: 0.2,
  },

  // Desktop styles
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    paddingTop: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  dockRowDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    maxWidth: '96%',
    alignSelf: 'center',
  },
  barOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    alignSelf: 'center',
    ...Shadow.lg,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  slotLabel: {
    fontSize: 12.5,
    includeFontPadding: false,
    letterSpacing: 0.1,
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
