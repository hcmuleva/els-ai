import { useState, useRef } from 'react';
import { Redirect, router } from 'expo-router';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import {
  Eye, EyeOff,
  GraduationCap, Users, BookOpen, ShieldCheck, Settings2,
  Zap, TrendingUp,
} from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';

import { useAuth } from '../src/context/AuthContext';
import { Colors, Radius, Shadow } from '../src/theme';
import { AVATAR_THINKING } from '../src/assets/svgs';

// ── Types ─────────────────────────────────────────────────────────────────────
type IconComponent = React.ComponentType<{ size: number; color: string }>;

type DemoAccount = {
  label: string;
  email: string;
  Icon: IconComponent;
  role: string;
  color: string;
  bg: string;
};

type FeatureItem = {
  Icon: IconComponent;
  label: string;
};

// ── Data ──────────────────────────────────────────────────────────────────────
const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'Student',    email: 'rahul@els.ai',   Icon: GraduationCap, role: 'Student',    color: Colors.primary, bg: Colors.primaryLight },
  { label: 'Parent',     email: 'ramesh@els.ai',  Icon: Users,         role: 'Parent',     color: Colors.success, bg: Colors.successLight },
  { label: 'Teacher',    email: 'teacher@els.ai', Icon: BookOpen,      role: 'Teacher',    color: Colors.accent,  bg: Colors.accentLight  },
  { label: 'Admin',      email: 'admin@els.ai',   Icon: Settings2,     role: 'Org Admin',  color: Colors.warning, bg: Colors.warningLight },
  { label: 'Superadmin', email: 'super@els.ai',   Icon: ShieldCheck,   role: 'Superadmin', color: Colors.purple,  bg: Colors.purpleLight  },
];

const FEATURES: FeatureItem[] = [
  { Icon: BookOpen,   label: 'Smart Lessons'  },
  { Icon: TrendingUp, label: 'Track Progress' },
  { Icon: Zap,        label: 'Fun Quizzes'    },
];

// ── Animated Pressable ────────────────────────────────────────────────────────
// wrapperStyle → applied to Pressable (layout: flex, sizing)
// style        → applied to Animated.View (visual: bg, border, padding)
function AnimatedPressable({ onPress, disabled, style, wrapperStyle, children }: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  wrapperStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={wrapperStyle}
      onPressIn={() => {
        Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30, bounciness: 2 }).start();
      }}
      onPressOut={() => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 2 }).start();
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { isAuthenticated, signIn } = useAuth();
  const [identifier, setIdentifier]     = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  if (isAuthenticated) return <Redirect href="/(tabs)" />;

  const handleLogin = async () => {
    if (!identifier.trim()) { setError('Please enter your email.'); return; }
    if (!password.trim())   { setError('Please enter your password.'); return; }
    setError('');
    setLoading(true);
    const result = await signIn(identifier, password);
    setLoading(false);
    if (result.success) router.replace('/(tabs)');
    else setError(result.error || 'Invalid credentials');
  };

  const handleDemoLogin = async (email: string) => {
    setIdentifier(email);
    setPassword('welcome');
    setError('');
    setLoading(true);
    const result = await signIn(email, 'welcome');
    setLoading(false);
    if (result.success) router.replace('/(tabs)');
    else setError(result.error || 'Login failed');
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero ───────────────────────────────────────────── */}
        <View style={s.hero}>
          {/* Background blobs */}
          <View style={[s.blob, s.blobBlue]}  />
          <View style={[s.blob, s.blobCoral]} />
          <View style={[s.blob, s.blobGreen]} />

          <View style={s.heroRow}>
            {/* Left: brand + tagline + pills */}
            <View style={s.heroLeft}>
              <View style={s.brand}>
                <Image
                  source={require('../assets/emeelan-logo.png')}
                  style={s.logo}
                  resizeMode="contain"
                />
                <View style={s.brandName}>
                  <Text style={s.brandEls}>ELS</Text>
                  <Text style={s.brandDot}>·</Text>
                  <Text style={s.brandAi}>AI</Text>
                </View>
              </View>
              <Text style={s.heroTagline}>A Smarter Way{'\n'}to Learn</Text>
              <View style={s.featureRow}>
                {FEATURES.map(({ Icon, label }) => (
                  <View key={label} style={s.featurePill}>
                    <Icon size={11} color={Colors.primary} />
                    <Text style={s.featurePillText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Right: mascot */}
            <View style={s.heroMascot}>
              <SvgXml xml={AVATAR_THINKING} width={140} height={140} />
            </View>
          </View>
        </View>

        {/* ─── Card ───────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Welcome Back</Text>
          <Text style={s.cardSub}>Sign in to continue your journey</Text>

          {/* Email */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Email or Phone</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textDisabled}
              style={s.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Password</Text>
            <View style={s.pwWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textDisabled}
                style={s.pwInput}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
                {showPassword
                  ? <EyeOff size={18} color={Colors.textMuted} />
                  : <Eye    size={18} color={Colors.textMuted} />}
              </Pressable>
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Login button */}
          <AnimatedPressable onPress={handleLogin} disabled={loading} style={s.loginBtn}>
            <Text style={s.loginBtnText}>{loading ? 'Signing in…' : 'Start Learning'}</Text>
          </AnimatedPressable>

          {/* Demo section */}
          <View style={s.demoSection}>
            <View style={s.demoLabelRow}>
              <View style={s.demoLine} />
              <Text style={s.demoLabel}>Try a Demo Account</Text>
              <View style={s.demoLine} />
            </View>
            <View style={s.demoGrid}>
              {DEMO_ACCOUNTS.map((d) => (
                <AnimatedPressable
                  key={d.label}
                  wrapperStyle={s.demoBtnWrapper}
                  style={[s.demoBtn, { backgroundColor: d.bg, borderColor: d.color + '30' }]}
                  onPress={() => handleDemoLogin(d.email)}
                >
                  <View style={[s.demoIconWrap, { backgroundColor: d.color + '18' }]}>
                    <d.Icon size={16} color={d.color} />
                  </View>
                  <Text style={[s.demoBtnName, { color: d.color }]}>{d.label}</Text>
                  <Text style={[s.demoBtnRole, { color: d.color + 'AA' }]}>{d.role}</Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1 },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: {
    height: 280,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob:      { position: 'absolute', borderRadius: 999 },
  blobBlue:  { width: 220, height: 220, backgroundColor: 'rgba(74,127,224,0.12)',  top: -80,  left: -60   },
  blobCoral: { width: 180, height: 180, backgroundColor: 'rgba(255,123,84,0.10)',  top: -30,  right: -50  },
  blobGreen: { width: 160, height: 160, backgroundColor: 'rgba(82,183,136,0.09)',  bottom: -50, left: 60  },

  heroRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 },
  heroLeft:   { flex: 1, paddingRight: 8 },
  heroMascot: { width: 140, height: 140 },

  brand:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  logo:      { width: 38, height: 38, borderRadius: Radius.md },
  brandName: { flexDirection: 'row', alignItems: 'center' },
  brandEls:  { fontSize: 26, fontWeight: '900', color: Colors.primary, letterSpacing: 1.5 },
  brandDot:  { fontSize: 26, fontWeight: '900', color: Colors.accent, marginHorizontal: 2 },
  brandAi:   { fontSize: 26, fontWeight: '900', color: Colors.accent, letterSpacing: 1.5 },

  heroTagline: {
    fontSize: 18, fontWeight: '900', color: Colors.text,
    textAlign: 'left', lineHeight: 26, marginBottom: 14,
  },

  featureRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featurePill:     {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(74,127,224,0.09)',
    borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 4,
  },
  featurePillText: { fontSize: 10, fontWeight: '700', color: Colors.primary },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 48,
    ...Shadow.lg,
  },
  cardTitle: { fontSize: 24, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  cardSub:   { fontSize: 14, fontWeight: '500', color: Colors.textMuted, marginBottom: 20 },

  // ── Fields ───────────────────────────────────────────────────────────────
  fieldWrap:  { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 14, color: Colors.text,
  },
  pwWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  pwInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: Colors.text },
  eyeBtn:  { paddingLeft: 10, paddingVertical: 8 },

  // ── Error ────────────────────────────────────────────────────────────────
  errorBox:  {
    backgroundColor: Colors.errorLight, borderRadius: Radius.sm,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  errorText: { fontSize: 12, fontWeight: '600', color: Colors.error },

  // ── Login button ─────────────────────────────────────────────────────────
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  loginBtnText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },

  // ── Demo section ─────────────────────────────────────────────────────────
  demoSection:  { marginTop: 24 },
  demoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  demoLine:     { flex: 1, height: 1, backgroundColor: Colors.borderLight },
  demoLabel:    { fontSize: 11, fontWeight: '700', color: Colors.textDisabled },
  demoGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoBtnWrapper: { flexBasis: '31%', flexGrow: 1, minWidth: 92 },
  demoBtn: {
    width: '100%', alignItems: 'center', gap: 4,
    borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 4,
    borderWidth: 1.5,
    ...Shadow.sm,
  },
  demoIconWrap: {
    width: 34, height: 34, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  demoBtnText: {},
  demoBtnName: { fontSize: 11, fontWeight: '800' },
  demoBtnRole: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
});
