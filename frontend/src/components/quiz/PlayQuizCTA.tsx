import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight, Cloud, Heart, Leaf, Moon, Play, Rocket, Sparkles, Star, Sun, Zap,
} from 'lucide-react-native';

export type QuizCtaTheme =
  | 'cosmic'
  | 'sunset'
  | 'forest'
  | 'bubblegum'
  | 'ocean'
  | 'sunny'
  | 'mint'
  | 'candy'
  | 'galaxy'
  | 'gold';

type SprinkleShape = 'dot' | 'bar' | 'star' | 'heart' | 'sparkle' | 'sun' | 'moon' | 'leaf' | 'cloud' | 'zap' | 'rocket';
type Sprinkle = {
  shape: SprinkleShape;
  top?: number; left?: number; right?: number; bottom?: number;
  color: string; size?: number; rotate?: number; opacity?: number;
};

type ThemeConfig = {
  bg: [string, string, ...string[]];
  borderColor: string;
  shadowColor: string;
  textColor: string;
  subtitleColor: string;
  playBtnBg: string;
  playBtnIconColor: string;
  chevBg: string;
  chevColor: string;
  accent: string;
  AccentIcon?: React.ComponentType<{ size: number; color: string; fill?: string }>;
  borderRadius?: number;
  sprinkles: Sprinkle[];
};

const THEMES: Record<QuizCtaTheme, ThemeConfig> = {
  cosmic: {
    bg: ['#7C3AED', '#4338CA', '#1E3A8A'],
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#1E3A8A',
    textColor: '#FFFFFF',
    subtitleColor: 'rgba(255,255,255,0.85)',
    playBtnBg: '#FFFFFF',
    playBtnIconColor: '#1E3A8A',
    chevBg: 'rgba(255,255,255,0.22)',
    chevColor: '#FFFFFF',
    accent: '#FBBF24',
    AccentIcon: Star,
    borderRadius: 16,
    sprinkles: [
      { shape: 'star', top: 6,  right: 60,  color: '#FBBF24', size: 10 },
      { shape: 'star', bottom: 8, right: 80, color: '#F472B6', size: 8 },
      { shape: 'dot', top: 18, right: 110, color: '#34D399', size: 4 },
      { shape: 'bar', top: 24, right: 130, color: '#FBBF24', rotate: 20 },
      { shape: 'dot', top: 8, left: 70, color: '#FBBF24', size: 6 },
      { shape: 'dot', top: 20, left: 130, color: '#F472B6', size: 5 },
      { shape: 'bar', top: 14, left: 100, color: '#34D399', rotate: 35 },
      { shape: 'bar', bottom: 14, left: 160, color: '#67E8F9', rotate: -25 },
      { shape: 'sparkle', top: 4, right: 30, color: '#FFFFFF', size: 12 },
    ],
  },

  sunset: {
    bg: ['#F97316', '#EC4899', '#8B5CF6'],
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#9333EA',
    textColor: '#FFFFFF',
    subtitleColor: 'rgba(255,255,255,0.92)',
    playBtnBg: '#FFFFFF',
    playBtnIconColor: '#DB2777',
    chevBg: 'rgba(255,255,255,0.25)',
    chevColor: '#FFFFFF',
    accent: '#FEF3C7',
    AccentIcon: Sun,
    borderRadius: 18,
    sprinkles: [
      { shape: 'sun', top: 4, right: 50, color: '#FEF3C7', size: 14 },
      { shape: 'dot', top: 22, right: 90, color: '#FBBF24', size: 5 },
      { shape: 'dot', bottom: 12, right: 70, color: '#FFFFFF', size: 4 },
      { shape: 'star', bottom: 8, right: 120, color: '#FEF3C7', size: 9 },
      { shape: 'bar', top: 16, left: 90, color: '#FED7AA', rotate: 30 },
      { shape: 'dot', top: 10, left: 130, color: '#FFFFFF', size: 5 },
      { shape: 'sparkle', bottom: 10, left: 100, color: '#FEF3C7', size: 11 },
    ],
  },

  forest: {
    bg: ['#10B981', '#059669', '#065F46'],
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#064E3B',
    textColor: '#FFFFFF',
    subtitleColor: 'rgba(220,252,231,0.92)',
    playBtnBg: '#FEF3C7',
    playBtnIconColor: '#065F46',
    chevBg: 'rgba(255,255,255,0.22)',
    chevColor: '#FFFFFF',
    accent: '#86EFAC',
    AccentIcon: Leaf,
    borderRadius: 18,
    sprinkles: [
      { shape: 'leaf', top: 6, right: 50, color: '#86EFAC', size: 14, rotate: -20 },
      { shape: 'leaf', bottom: 8, right: 100, color: '#A7F3D0', size: 12, rotate: 25 },
      { shape: 'leaf', top: 16, left: 90, color: '#86EFAC', size: 11, rotate: 40 },
      { shape: 'dot', top: 8, left: 60, color: '#FBBF24', size: 4 },
      { shape: 'dot', bottom: 12, left: 140, color: '#FEF3C7', size: 5 },
      { shape: 'star', top: 24, right: 120, color: '#FEF3C7', size: 8 },
    ],
  },

  bubblegum: {
    bg: ['#FBCFE8', '#F472B6', '#A855F7'],
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: '#DB2777',
    textColor: '#831843',
    subtitleColor: 'rgba(131,24,67,0.78)',
    playBtnBg: '#FFFFFF',
    playBtnIconColor: '#DB2777',
    chevBg: 'rgba(131,24,67,0.18)',
    chevColor: '#831843',
    accent: '#DB2777',
    AccentIcon: Heart,
    borderRadius: 22,
    sprinkles: [
      { shape: 'heart', top: 6, right: 40, color: '#DB2777', size: 12 },
      { shape: 'heart', bottom: 8, right: 100, color: '#F472B6', size: 10 },
      { shape: 'dot', top: 20, right: 75, color: '#FFFFFF', size: 6, opacity: 0.85 },
      { shape: 'dot', bottom: 14, right: 55, color: '#FBBF24', size: 5 },
      { shape: 'dot', top: 10, left: 80, color: '#FFFFFF', size: 7, opacity: 0.85 },
      { shape: 'heart', bottom: 10, left: 120, color: '#FFFFFF', size: 9, opacity: 0.9 },
      { shape: 'sparkle', top: 18, left: 140, color: '#FFFFFF', size: 11 },
    ],
  },

  ocean: {
    bg: ['#22D3EE', '#0EA5E9', '#1E3A8A'],
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#0C4A6E',
    textColor: '#FFFFFF',
    subtitleColor: 'rgba(207,250,254,0.95)',
    playBtnBg: '#FFFFFF',
    playBtnIconColor: '#0369A1',
    chevBg: 'rgba(255,255,255,0.22)',
    chevColor: '#FFFFFF',
    accent: '#67E8F9',
    AccentIcon: Sparkles,
    borderRadius: 16,
    sprinkles: [
      { shape: 'bar', top: 14, right: 60, color: '#67E8F9', rotate: -20 },
      { shape: 'bar', bottom: 14, right: 100, color: '#FFFFFF', rotate: 15, opacity: 0.7 },
      { shape: 'bar', top: 10, left: 90, color: '#A5F3FC', rotate: 30 },
      { shape: 'dot', top: 22, right: 90, color: '#FFFFFF', size: 5 },
      { shape: 'dot', bottom: 10, left: 130, color: '#FBBF24', size: 4 },
      { shape: 'sparkle', top: 6, right: 30, color: '#FFFFFF', size: 12 },
      { shape: 'cloud', top: 6, left: 60, color: '#FFFFFF', size: 14, opacity: 0.6 },
    ],
  },

  sunny: {
    bg: ['#FACC15', '#F97316', '#DC2626'],
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: '#B45309',
    textColor: '#FFFFFF',
    subtitleColor: 'rgba(255,251,235,0.95)',
    playBtnBg: '#FFFFFF',
    playBtnIconColor: '#B45309',
    chevBg: 'rgba(255,255,255,0.25)',
    chevColor: '#FFFFFF',
    accent: '#FFFFFF',
    AccentIcon: Sun,
    borderRadius: 18,
    sprinkles: [
      { shape: 'sun', top: 4, right: 40, color: '#FEF3C7', size: 16 },
      { shape: 'star', bottom: 8, right: 90, color: '#FFFFFF', size: 10 },
      { shape: 'dot', top: 20, right: 110, color: '#FFFFFF', size: 5 },
      { shape: 'dot', bottom: 12, left: 130, color: '#FFFFFF', size: 4 },
      { shape: 'bar', top: 14, left: 80, color: '#FED7AA', rotate: 35 },
      { shape: 'sparkle', top: 22, left: 130, color: '#FFFFFF', size: 11 },
    ],
  },

  mint: {
    bg: ['#A7F3D0', '#67E8F9', '#A5B4FC'],
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#10B981',
    textColor: '#064E3B',
    subtitleColor: 'rgba(6,78,59,0.78)',
    playBtnBg: '#10B981',
    playBtnIconColor: '#FFFFFF',
    chevBg: 'rgba(6,78,59,0.18)',
    chevColor: '#064E3B',
    accent: '#059669',
    AccentIcon: Sparkles,
    borderRadius: 20,
    sprinkles: [
      { shape: 'sparkle', top: 6, right: 50, color: '#FFFFFF', size: 14, opacity: 0.8 },
      { shape: 'dot', top: 22, right: 90, color: '#FFFFFF', size: 6, opacity: 0.8 },
      { shape: 'dot', bottom: 10, right: 60, color: '#10B981', size: 5 },
      { shape: 'sparkle', bottom: 10, right: 110, color: '#10B981', size: 10 },
      { shape: 'dot', top: 10, left: 80, color: '#FFFFFF', size: 6, opacity: 0.8 },
      { shape: 'dot', bottom: 14, left: 130, color: '#A855F7', size: 4 },
    ],
  },

  candy: {
    bg: ['#A855F7', '#EC4899', '#F97316'],
    borderColor: 'rgba(255,255,255,0.32)',
    shadowColor: '#9333EA',
    textColor: '#FFFFFF',
    subtitleColor: 'rgba(255,255,255,0.92)',
    playBtnBg: '#FFFFFF',
    playBtnIconColor: '#9333EA',
    chevBg: 'rgba(255,255,255,0.25)',
    chevColor: '#FFFFFF',
    accent: '#FEF3C7',
    AccentIcon: Star,
    borderRadius: 18,
    sprinkles: [
      { shape: 'bar', top: 8, right: 40, color: '#FEF3C7', rotate: -25 },
      { shape: 'bar', top: 18, right: 70, color: '#86EFAC', rotate: 15 },
      { shape: 'bar', bottom: 12, right: 90, color: '#67E8F9', rotate: -10 },
      { shape: 'bar', bottom: 8, right: 50, color: '#FBBF24', rotate: 28 },
      { shape: 'bar', top: 12, left: 80, color: '#A7F3D0', rotate: 30 },
      { shape: 'bar', bottom: 10, left: 130, color: '#FFFFFF', rotate: -20, opacity: 0.85 },
      { shape: 'dot', top: 22, left: 130, color: '#FBBF24', size: 5 },
      { shape: 'star', top: 4, right: 100, color: '#FFFFFF', size: 9 },
    ],
  },

  galaxy: {
    bg: ['#1E1B4B', '#312E81', '#7C3AED'],
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#1E1B4B',
    textColor: '#FFFFFF',
    subtitleColor: 'rgba(224,231,255,0.92)',
    playBtnBg: '#FBBF24',
    playBtnIconColor: '#1E1B4B',
    chevBg: 'rgba(255,255,255,0.18)',
    chevColor: '#FFFFFF',
    accent: '#FBBF24',
    AccentIcon: Sparkles,
    borderRadius: 16,
    sprinkles: [
      { shape: 'star', top: 6, right: 30, color: '#FBBF24', size: 11 },
      { shape: 'star', bottom: 8, right: 70, color: '#FFFFFF', size: 9 },
      { shape: 'star', top: 22, right: 110, color: '#FBBF24', size: 7 },
      { shape: 'dot', top: 12, right: 50, color: '#FFFFFF', size: 3 },
      { shape: 'dot', bottom: 14, right: 100, color: '#FBBF24', size: 3 },
      { shape: 'dot', top: 10, left: 70, color: '#FFFFFF', size: 4 },
      { shape: 'star', top: 20, left: 110, color: '#FFFFFF', size: 8 },
      { shape: 'sparkle', bottom: 8, left: 130, color: '#FBBF24', size: 12 },
      { shape: 'moon', top: 6, left: 50, color: '#FBBF24', size: 12 },
    ],
  },

  gold: {
    bg: ['#FBBF24', '#F59E0B', '#92400E'],
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#92400E',
    textColor: '#FFFFFF',
    subtitleColor: 'rgba(255,251,235,0.95)',
    playBtnBg: '#FFFFFF',
    playBtnIconColor: '#92400E',
    chevBg: 'rgba(255,255,255,0.3)',
    chevColor: '#FFFFFF',
    accent: '#FFFFFF',
    AccentIcon: Star,
    borderRadius: 22,
    sprinkles: [
      { shape: 'star', top: 6, right: 40, color: '#FFFFFF', size: 12 },
      { shape: 'star', bottom: 8, right: 80, color: '#FEF3C7', size: 10 },
      { shape: 'sparkle', top: 18, right: 110, color: '#FFFFFF', size: 12 },
      { shape: 'dot', bottom: 14, right: 60, color: '#FFFFFF', size: 5 },
      { shape: 'star', top: 10, left: 80, color: '#FEF3C7', size: 10 },
      { shape: 'sparkle', bottom: 10, left: 130, color: '#FFFFFF', size: 11 },
      { shape: 'dot', top: 24, left: 130, color: '#FEF3C7', size: 4 },
    ],
  },
};

export const QUIZ_CTA_THEMES: QuizCtaTheme[] = [
  'cosmic', 'sunset', 'forest', 'bubblegum', 'ocean', 'sunny', 'mint', 'candy', 'galaxy', 'gold',
];

export function pickQuizCtaTheme(key: string | null | undefined): QuizCtaTheme {
  const k = String(key ?? '');
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return QUIZ_CTA_THEMES[h % QUIZ_CTA_THEMES.length];
}

type Props = {
  onPress: () => void;
  title?: string;
  subtitle?: string;
  theme?: QuizCtaTheme;
  themeKey?: string;
  style?: any;
};

export default function PlayQuizCTA({
  onPress,
  title = 'Play Quiz',
  subtitle = 'Tap to test what you learned',
  theme,
  themeKey,
  style,
}: Props) {
  const resolvedTheme: QuizCtaTheme = theme ?? (themeKey ? pickQuizCtaTheme(themeKey) : 'cosmic');
  const t = THEMES[resolvedTheme];
  const AccentIcon = t.AccentIcon ?? Star;
  const radius = t.borderRadius ?? 16;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
      style={({ pressed }) => [
        styles.wrap,
        { borderRadius: radius, shadowColor: t.shadowColor },
        pressed && { transform: [{ scale: 0.985 }], opacity: 0.94 },
        style,
      ]}
    >
      <LinearGradient
        colors={t.bg as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderRadius: radius, borderColor: t.borderColor }]}
      >
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {t.sprinkles.map((sp, i) => renderSprinkle(sp, i))}
        </View>

        <View style={[styles.playBtn, { backgroundColor: t.playBtnBg }]}>
          <Play size={18} color={t.playBtnIconColor} fill={t.playBtnIconColor} />
        </View>

        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: t.textColor }]}>{title}</Text>
            <AccentIcon size={12} color={t.accent} fill={t.accent} />
          </View>
          <Text style={[styles.subtitle, { color: t.subtitleColor }]} numberOfLines={1}>{subtitle}</Text>
        </View>

        <View style={[styles.chevWrap, { backgroundColor: t.chevBg, borderColor: 'rgba(255,255,255,0.3)' }]}>
          <ChevronRight size={18} color={t.chevColor} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function renderSprinkle(sp: Sprinkle, key: number) {
  const pos: any = {
    position: 'absolute',
    top: sp.top, left: sp.left, right: sp.right, bottom: sp.bottom,
    opacity: sp.opacity ?? 0.85,
  };
  if (sp.rotate !== undefined) pos.transform = [{ rotate: `${sp.rotate}deg` }];

  if (sp.shape === 'dot') {
    const size = sp.size ?? 5;
    return <View key={key} style={[pos, { width: size, height: size, borderRadius: 999, backgroundColor: sp.color }]} />;
  }
  if (sp.shape === 'bar') {
    return <View key={key} style={[pos, { width: 9, height: 3, borderRadius: 2, backgroundColor: sp.color }]} />;
  }
  const Icon =
    sp.shape === 'star'    ? Star    :
    sp.shape === 'heart'   ? Heart   :
    sp.shape === 'sparkle' ? Sparkles:
    sp.shape === 'sun'     ? Sun     :
    sp.shape === 'moon'    ? Moon    :
    sp.shape === 'leaf'    ? Leaf    :
    sp.shape === 'cloud'   ? Cloud   :
    sp.shape === 'zap'     ? Zap     :
    sp.shape === 'rocket'  ? Rocket  : Star;
  const size = sp.size ?? 12;
  const fillable = sp.shape === 'star' || sp.shape === 'heart';
  return (
    <View key={key} style={pos}>
      <Icon size={size} color={sp.color} {...(fillable ? { fill: sp.color } : {})} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  playBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  textCol: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  subtitle: { fontSize: 12, fontWeight: '500' },
  chevWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
