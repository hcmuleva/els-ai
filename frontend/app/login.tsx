import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import {
  Image, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { useAuth } from '../src/context/AuthContext';

// ── Floating artwork blobs ────────────────────────────────────────────────────
const ARTWORKS: Array<{ emoji: string; size: number; top?: number; bottom?: number; left?: number; right?: number; rotate: string }> = [
  { emoji: '🦒', size: 48, top: 12,    left: 10,  rotate: '-10deg' },
  { emoji: '📚', size: 40, top: 8,     right: 10, rotate: '8deg'   },
  { emoji: '🐧', size: 36, bottom: 10, left: 8,   rotate: '-6deg'  },
  { emoji: '🎨', size: 36, bottom: 8,  right: 8,  rotate: '10deg'  },
];

const DEMO_ACCOUNTS = [
  { label: 'Super',   email: 'super@els.ai',   emoji: '⭐' },
  { label: 'Teacher', email: 'teacher@els.ai', emoji: '🍎' },
  { label: 'Student', email: 'student@els.ai', emoji: '🎒' },
  { label: 'Parent',  email: 'parent@els.ai',  emoji: '👨‍👩‍👧' },
];

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
    setError(''); setLoading(true);
    const result = await signIn(identifier, password);
    setLoading(false);
    if (result.success) router.replace('/(tabs)');
    else setError(result.error || 'Invalid credentials');
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
        {/* ─── Hero artwork area ─────────────────────────────────────── */}
        <View style={s.hero}>
          {/* BG blobs */}
          <View style={[s.blob, s.blobBlue]}  />
          <View style={[s.blob, s.blobCoral]} />
          <View style={[s.blob, s.blobGreen]} />

          {/* Floating emojis */}
          {ARTWORKS.map((a, i) => (
            <View
              key={i}
              style={[
                s.floatEmoji,
                {
                  ...(a.top    !== undefined ? { top:    a.top    } : {}),
                  ...(a.bottom !== undefined ? { bottom: a.bottom } : {}),
                  ...(a.left   !== undefined ? { left:   a.left   } : {}),
                  ...(a.right  !== undefined ? { right:  a.right  } : {}),
                  transform: [{ rotate: a.rotate }],
                },
              ]}
            >
              <Text style={{ fontSize: a.size }}>{a.emoji}</Text>
            </View>
          ))}

          {/* Logo + brand */}
          <View style={s.brand}>
            <Image source={require('../assets/emeelan-logo.png')} style={s.logo} />
            <View style={s.brandName}>
              <Text style={s.brandEls}>ELS</Text>
              <Text style={s.brandDot}>·</Text>
              <Text style={s.brandAi}>AI</Text>
            </View>
          </View>

          <Text style={s.heroTagline}>A Fun Way to{'\n'}Learn New Things! 🚀</Text>

          {/* Hashtag pills */}
          <View style={s.hashRow}>
            {['#MathFun', '#BrainGames', '#KidsLearn'].map((h) => (
              <View key={h} style={s.hashPill}>
                <Text style={s.hashText}>{h}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ─── Login card ────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Welcome Back! 👋</Text>
          <Text style={s.cardSub}>Sign in to continue your journey</Text>

          {/* Email */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Email or Phone</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@example.com"
              placeholderTextColor="#B0B8CC"
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
                placeholderTextColor="#B0B8CC"
                style={s.pwInput}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
                {showPassword
                  ? <EyeOff size={18} color="#9A9AB0" />
                  : <Eye    size={18} color="#9A9AB0" />}
              </Pressable>
            </View>
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          {/* Login button */}
          <Pressable onPress={handleLogin} style={s.loginBtn} disabled={loading}>
            <Text style={s.loginBtnText}>{loading ? 'Signing in…' : 'Start Learning »'}</Text>
          </Pressable>

          {/* Demo accounts */}
          <View style={s.demoSection}>
            <View style={s.demoLabelRow}>
              <View style={s.demoLine} />
              <Text style={s.demoLabel}>Quick Demo</Text>
              <View style={s.demoLine} />
            </View>
            <View style={s.demoGrid}>
              {DEMO_ACCOUNTS.map((d) => (
                <Pressable
                  key={d.label}
                  style={s.demoBtn}
                  onPress={() => { setIdentifier(d.email); setPassword('welcome'); }}
                >
                  <Text style={s.demoBtnEmoji}>{d.emoji}</Text>
                  <Text style={s.demoBtnLabel}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F0F4FF' },
  scroll: { flexGrow: 1 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    height: 260, position: 'relative',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute', borderRadius: 999,
  },
  blobBlue:  { width: 200, height: 200, backgroundColor: 'rgba(74,144,226,0.18)', top: -60,  left: -60  },
  blobCoral: { width: 160, height: 160, backgroundColor: 'rgba(255,112,67,0.14)',  top: -20,  right: -40 },
  blobGreen: { width: 140, height: 140, backgroundColor: 'rgba(125,198,122,0.14)', bottom: -40, left: 60 },

  floatEmoji: { position: 'absolute' },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  logo:  { width: 42, height: 42, borderRadius: 12 },
  brandName: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  brandEls:  { fontSize: 28, fontWeight: '900', color: '#4A90E2', letterSpacing: 1 },
  brandDot:  { fontSize: 28, fontWeight: '900', color: '#FF7043' },
  brandAi:   { fontSize: 28, fontWeight: '900', color: '#FF7043', letterSpacing: 1 },

  heroTagline: {
    fontSize: 18, fontWeight: '900', color: '#1a1a2e',
    textAlign: 'center', lineHeight: 26, marginBottom: 14,
  },

  hashRow:  { flexDirection: 'row', gap: 8 },
  hashPill: {
    backgroundColor: 'rgba(74,144,226,0.12)',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  hashText: { fontSize: 11, fontWeight: '700', color: '#4A90E2' },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: 28, paddingBottom: 40,
    gap: 4,
    shadowColor: '#1a1a3e',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: { fontSize: 22, fontWeight: '900', color: '#1a1a2e', marginBottom: 2 },
  cardSub:   { fontSize: 13, fontWeight: '500', color: '#9A9AB0', marginBottom: 14 },

  // Fields
  fieldWrap:  { gap: 6, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#5A5A7A' },
  input: {
    backgroundColor: '#F8F9FF', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#EBEBF8',
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 14, color: '#1a1a2e',
  },
  pwWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FF', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#EBEBF8',
    paddingHorizontal: 16,
  },
  pwInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: '#1a1a2e' },
  eyeBtn:  { paddingLeft: 8, paddingVertical: 6 },

  error: { fontSize: 12, fontWeight: '700', color: '#FF4444', marginTop: 2 },

  loginBtn: {
    backgroundColor: '#4A90E2', borderRadius: 16,
    paddingVertical: 15, alignItems: 'center',
    marginTop: 6,
    shadowColor: '#4A90E2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  loginBtnText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },

  // Demo
  demoSection:  { marginTop: 20 },
  demoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  demoLine:     { flex: 1, height: 1, backgroundColor: '#F0F0F8' },
  demoLabel:    { fontSize: 11, fontWeight: '700', color: '#B0B8CC' },
  demoGrid:     { flexDirection: 'row', gap: 8 },
  demoBtn: {
    flex: 1, alignItems: 'center', gap: 4,
    backgroundColor: '#F8F9FF', borderRadius: 14,
    paddingVertical: 10, borderWidth: 1, borderColor: '#EBEBF8',
  },
  demoBtnEmoji: { fontSize: 22 },
  demoBtnLabel: { fontSize: 11, fontWeight: '700', color: '#5A5A7A' },
});
