/**
 * Card
 * Shared surface primitive for the three ad hoc "card" shapes duplicated
 * across Planner/Manage (and elsewhere): an elevated white panel with a
 * soft shadow (e.g. `fieldCard`/`previewCard`/`historyCard`), a bordered
 * panel with no shadow (e.g. Manage's outlined `section`), and a flat
 * grouped container with neither (e.g. `secGroup`). Built on the
 * `Colors`/`Radius`/`Shadow`/`Spacing` tokens so callers get the current
 * design-token values for free instead of re-declaring hex/shadow literals
 * per screen.
 */

import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Radius, Shadow, Spacing } from '../../theme';

export type CardVariant = 'elevated' | 'outlined' | 'flat';

interface CardProps {
  children?: React.ReactNode;
  variant?: CardVariant;
  /** Which `Shadow.*` token to use when `variant="elevated"` (default `sm`). */
  shadow?: keyof typeof Shadow;
  /** Inner padding; pass 0 for grouped containers that manage their own row padding. */
  padding?: number;
  radius?: number;
  /**
   * Defaults to `visible` for `elevated` (so the iOS shadow isn't clipped by
   * the card's own bounds) and `hidden` for `outlined`/`flat` (so rounded
   * corners clip inner content cleanly). Override only if a screen relies on
   * different clipping behavior.
   */
  overflow?: ViewStyle['overflow'];
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  variant = 'elevated',
  shadow = 'sm',
  padding = Spacing.base,
  radius = Radius.lg,
  overflow,
  style,
}: CardProps) {
  const variantStyle: ViewStyle =
    variant === 'elevated'
      ? { ...Shadow[shadow], overflow: overflow ?? 'visible' }
      : variant === 'outlined'
      ? { borderWidth: 1, borderColor: Colors.borderLight, overflow: overflow ?? 'hidden' }
      : { overflow: overflow ?? 'hidden' };

  return (
    <View
      style={[
        { backgroundColor: Colors.surface, borderRadius: radius, padding },
        variantStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default Card;
