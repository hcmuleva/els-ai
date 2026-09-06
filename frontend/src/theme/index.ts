// ── ELS·AI Design System ───────────────────────────────────────────────────
// Centralized tokens: Colors · Radius · Shadow · Spacing
// Philosophy: Professional + Kid-Friendly — clean, soft, structured

// Values below were originally aligned to whichever hex literal was actually
// dominant across the shipped app (checked via a repo-wide grep) so that
// introducing this file was a visual no-op. `primary`, `accent`, and
// `textMuted` were then darkened from that baseline app-wide (via every
// file that referenced the literal, not just this token) after an
// `agent-browser a11y` audit found all three failed WCAG AA color-contrast
// (~3.3:1 / ~2.7:1 / ~2.75:1 against white; need 4.5:1) on every screen
// audited:
//   primary   #4A90E2 → #2D5DC9 (already used elsewhere as `primaryDark`)
//   accent    #FF7043 → #D33F13 (darkened deep-orange, same hue family)
//   textMuted #9A9AB0 → #525C6B (already used elsewhere as a secondary gray)
// See CLIENT_PLAN.md §4 backlog item 6.
export const Colors = {
  // ── Primary — Calm Blue ─────────────────────────────────────────────────
  primary:      '#2D5DC9',
  primaryLight: '#D6E8FF',
  primaryDark:  '#1E4A9E',

  // ── Accent — Soft Coral ──────────────────────────────────────────────────
  accent:       '#D33F13',
  accentLight:  '#FFE8DF',

  // ── Success — Accessible Green ───────────────────────────────────────────
  // Darkened from #52B788 (2.03:1 against successLight) so metric text and
  // success controls retain WCAG AA contrast on their light green surfaces.
  success:      '#176B47',
  successLight: '#D4EFE3',

  // ── Warning — Warm Amber ─────────────────────────────────────────────────
  warning:      '#F4A261',
  warningLight: '#FFF0DC',

  // ── Purple — Soft Violet ─────────────────────────────────────────────────
  // Darkened from #9B8EC4 (2.97:1 white-on-it — used as a solid CTA/pill
  // background with white text in several places) for the same a11y pass.
  purple:       '#6B5C97',
  purpleLight:  '#EDE4FF',

  // ── Text ─────────────────────────────────────────────────────────────────
  text:           '#1a1a2e',
  textSecondary:  '#4B5563',
  textMuted:      '#525C6B',
  textDisabled:   '#C4C9D6',

  // ── Surfaces ─────────────────────────────────────────────────────────────
  background:  '#F5F7FF',
  surface:     '#FFFFFF',
  surfaceAlt:  '#F8F9FF',
  border:      '#E8ECF4',
  borderLight: '#F0F0F8',

  // ── Semantic ─────────────────────────────────────────────────────────────
  error:      '#EF4444',
  errorLight: '#FEE2E2',
};

// Named per-role identity colors — the same categorical palette that was
// already duplicated as local consts in `CustomTabBar.tsx` (`TAB_COLORS`)
// and `ProfileMenu.tsx` (`ROLE_COLORS`). Distinct from the state-semantic
// `success`/`warning` above (e.g. "parent" and "superadmin" happen to be
// green/amber but identify a role, not a status).
export const RoleColors: Record<'student' | 'teacher' | 'parent' | 'admin' | 'superadmin', string> = {
  student:    Colors.primary,
  teacher:    Colors.accent,
  // parent/superadmin darkened from #7DC67A (2.05:1) / #E6A817 (2.10:1) —
  // both are used as solid tab-bar-pill/badge backgrounds with white text
  // and failed WCAG AA badly; see theme header comment + CLIENT_PLAN.md §6.
  parent:     '#3E7A3C',
  admin:      Colors.purple,
  superadmin: '#8F680C',
};

export const Typography = {
  size: {
    xs: 10, sm: 11, base: 12, md: 13, lg: 14, xl: 15, xxl: 16, display: 18, hero: 24,
  },
  weight: {
    regular: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
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
