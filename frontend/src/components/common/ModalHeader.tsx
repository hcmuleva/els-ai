/**
 * ModalHeader
 * Safe-area-aware header bar for full-screen modals and headerless screens.
 * Mirrors the reusable safe-area approach used across the app: the top inset
 * is applied once here (`Math.max(insets.top, minTop)`) so screen/modal bodies
 * never slip under the notch/status bar. Provides back/title/close slots that
 * can be overridden for custom layouts (e.g. a progress bar via `center`).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X } from 'lucide-react-native';
import { Colors } from '../../theme';

interface ModalHeaderProps {
  title?: string;
  subtitle?: string;
  /** Overrides the title/subtitle block entirely (e.g. a progress bar). */
  center?: React.ReactNode;
  /** Overrides the left slot. Falls back to a back button when `onBack` is set. */
  left?: React.ReactNode;
  /** Overrides the right slot. Falls back to a close button when `onClose` is set. */
  right?: React.ReactNode;
  onBack?: () => void;
  onClose?: () => void;
  tone?: string;
  titleColor?: string;
  subtitleColor?: string;
  iconColor?: string;
  /** Minimum top padding when there is no inset (default 12). */
  minTop?: number;
  borderless?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ModalHeader({
  title,
  subtitle,
  center,
  left,
  right,
  onBack,
  onClose,
  tone = Colors.surface,
  titleColor = Colors.text,
  subtitleColor = Colors.textMuted,
  iconColor = Colors.text,
  minTop = 12,
  borderless = false,
  style,
}: ModalHeaderProps) {
  const insets = useSafeAreaInsets();

  const leftNode =
    left ??
    (onBack ? (
      <Pressable onPress={onBack} style={styles.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
        <ArrowLeft size={22} color={iconColor} />
      </Pressable>
    ) : (
      <View style={styles.iconBtn} />
    ));

  const rightNode =
    right ??
    (onClose ? (
      <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
        <X size={22} color={iconColor} />
      </Pressable>
    ) : (
      <View style={styles.iconBtn} />
    ));

  return (
    <View
      style={[
        styles.header,
        { paddingTop: Math.max(insets.top, minTop), backgroundColor: tone },
        !borderless && styles.border,
        style,
      ]}
    >
      {leftNode}
      {center ?? (
        <View style={styles.titleWrap}>
          {title ? (
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subtitleColor }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
      {rightNode}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
});

export default ModalHeader;
