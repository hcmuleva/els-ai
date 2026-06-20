/**
 * SafeScreen
 * Themed full-height body wrapper that applies safe-area padding on the
 * requested edges (`Math.max(insets.x, min)`). Use it for full-screen views
 * that own their layout (no native header / no tab bar) so content never
 * slips under the notch or the home indicator. Pair the top edge with a
 * `ModalHeader` when a header bar is needed.
 */

import React from 'react';
import { View, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme';

type Edge = 'top' | 'bottom';

interface SafeScreenProps {
  children: React.ReactNode;
  edges?: Edge[];
  scroll?: boolean;
  background?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  minTop?: number;
  minBottom?: number;
}

export function SafeScreen({
  children,
  edges = ['top', 'bottom'],
  scroll = false,
  background = Colors.background,
  style,
  contentContainerStyle,
  minTop = 12,
  minBottom = 12,
}: SafeScreenProps) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: edges.includes('top') ? Math.max(insets.top, minTop) : 0,
    paddingBottom: edges.includes('bottom') ? Math.max(insets.bottom, minBottom) : 0,
  };

  if (scroll) {
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: background }, style]}
        contentContainerStyle={[pad, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.root, { backgroundColor: background }, pad, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default SafeScreen;
