// ── ELS·AI Design System ───────────────────────────────────────────────────
// Centralized tokens: Colors · Radius · Shadow · Spacing
// Philosophy: Professional + Kid-Friendly — clean, soft, structured

export const Colors = {
  // ── Primary — Calm Blue ─────────────────────────────────────────────────
  primary:      '#4A7FE0',
  primaryLight: '#D6E8FF',
  primaryDark:  '#2D5DC9',

  // ── Accent — Soft Coral ──────────────────────────────────────────────────
  accent:       '#FF7B54',
  accentLight:  '#FFE8DF',

  // ── Success — Soft Green ─────────────────────────────────────────────────
  success:      '#52B788',
  successLight: '#D4EFE3',

  // ── Warning — Warm Amber ─────────────────────────────────────────────────
  warning:      '#F4A261',
  warningLight: '#FFF0DC',

  // ── Purple — Soft Violet ─────────────────────────────────────────────────
  purple:       '#9B8EC4',
  purpleLight:  '#EDE4FF',

  // ── Text ─────────────────────────────────────────────────────────────────
  text:           '#1A1D3A',
  textSecondary:  '#4B5563',
  textMuted:      '#9CA3AF',
  textDisabled:   '#C4C9D6',

  // ── Surfaces ─────────────────────────────────────────────────────────────
  background:  '#F5F7FF',
  surface:     '#FFFFFF',
  surfaceAlt:  '#F8F9FF',
  border:      '#E8ECF4',
  borderLight: '#F0F2FA',

  // ── Semantic ─────────────────────────────────────────────────────────────
  error:      '#EF4444',
  errorLight: '#FEE2E2',
};

export const Radius = {
  xs:   6,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  card: 20,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A1D3A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
  xxxl: 40,
};
