import { Image, StyleSheet, View, ViewStyle } from 'react-native';

import {
  DEFAULT_SUBJECT_ICON,
  DEFAULT_SUBJECT_ICON_BG,
  DEFAULT_SUBJECT_ICON_COLOR,
  SUBJECT_ICON_LIBRARY_MAP,
  resolveSubjectSymbolKey,
} from './subjectIcons';

/**
 * Priority-based subject visual renderer.
 *
 *   1. coverImage  → render as <Image> (highest priority).
 *   2. icon        → "symbol:<key>" → lucide icon from SUBJECT_ICON_LIBRARY.
 *                    URL/data-URI → render as <Image>.
 *   3. fallback    → DEFAULT_SUBJECT_ICON (BookOpen) with neutral palette.
 */
export type SubjectVisualProps = {
  coverImage?: string | null;
  icon?: string | null;
  iconBgColor?: string | null;
  /** Foreground color used when an icon (not an image) is rendered. */
  iconColor?: string | null;
  size?: number;
  /** Diameter of the rounded container (defaults to size + 12). */
  containerSize?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

const isHttpUrl = (value: string) =>
  value.startsWith('http://') ||
  value.startsWith('https://') ||
  value.startsWith('data:') ||
  value.startsWith('/');

export default function SubjectVisual({
  coverImage,
  icon,
  iconBgColor,
  iconColor,
  size = 28,
  containerSize,
  borderRadius,
  style,
}: SubjectVisualProps) {
  const dim = containerSize ?? size + 26;
  const radius = borderRadius ?? Math.round(dim * 0.28);

  const cover = (coverImage || '').trim();
  const iconValue = (icon || '').trim();

  if (cover) {
    return (
      <View
        style={[
          s.box,
          { width: dim, height: dim, borderRadius: radius, backgroundColor: 'transparent' },
          style,
        ]}
      >
        <Image
          source={{ uri: cover }}
          style={{ width: dim, height: dim, borderRadius: radius }}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (iconValue) {
    const symbolKey = resolveSubjectSymbolKey(iconValue);
    if (symbolKey) {
      const entry = SUBJECT_ICON_LIBRARY_MAP[symbolKey];
      const fg = iconColor || entry.color;
      const bg = iconBgColor || `${fg}1F`;
      return (
        <View
          style={[
            s.box,
            { width: dim, height: dim, borderRadius: radius, backgroundColor: bg },
            style,
          ]}
        >
          <entry.Icon size={size} color={fg} />
        </View>
      );
    }

    if (isHttpUrl(iconValue)) {
      return (
        <View
          style={[
            s.box,
            { width: dim, height: dim, borderRadius: radius, backgroundColor: iconBgColor || 'transparent' },
            style,
          ]}
        >
          <Image
            source={{ uri: iconValue }}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        </View>
      );
    }
  }

  const fg = iconColor || DEFAULT_SUBJECT_ICON_COLOR;
  const bg = iconBgColor || DEFAULT_SUBJECT_ICON_BG;
  const FallbackIcon = DEFAULT_SUBJECT_ICON;
  return (
    <View
      style={[
        s.box,
        { width: dim, height: dim, borderRadius: radius, backgroundColor: bg },
        style,
      ]}
    >
      <FallbackIcon size={size} color={fg} />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
