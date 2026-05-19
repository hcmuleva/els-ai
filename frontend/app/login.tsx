import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { useAuth } from '../src/context/AuthContext';

export default function LoginScreen() {
  const { isAuthenticated, signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/emeelan-logo.png')} style={styles.logo} />
          <Text style={styles.brandTitle}>ELS</Text>
        </View>

        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Enter your details to continue</Text>

        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Email or phone number"
          style={styles.input}
          autoCapitalize="none"
        />

        <View style={styles.passwordInputWrapper}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <Pressable onPress={() => setShowPassword((prev) => !prev)} style={styles.eyeButton}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </Pressable>
        </View>

        <Pressable
          onPress={async () => {
            if (!identifier.trim()) {
              setError('Please enter email.');
              return;
            }

            if (!password.trim()) {
              setError('Please enter password.');
              return;
            }

            setError('');
            const result = await signIn(identifier, password);
            if (result.success) {
              router.replace('/(tabs)');
            } else {
              setError(result.error || 'Invalid credentials');
            }
          }}
          style={styles.loginButton}
        >
          <Text style={styles.loginButtonText}>Login</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.demoSection}>
          <Text style={styles.demoTitle}>Quick Demo Accounts</Text>
          <View style={styles.demoButtonsContainer}>
            <Pressable
              onPress={() => {
                setIdentifier('super@els.ai');
                setPassword('welcome');
              }}
              style={styles.demoButton}
            >
              <Text style={styles.demoButtonText}>Super User (All Roles)</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setIdentifier('teacher@els.ai');
                setPassword('welcome');
              }}
              style={styles.demoButton}
            >
              <Text style={styles.demoButtonText}>Teacher</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setIdentifier('student@els.ai');
                setPassword('welcome');
              }}
              style={styles.demoButton}
            >
              <Text style={styles.demoButtonText}>Student</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setIdentifier('parent@els.ai');
                setPassword('welcome');
              }}
              style={styles.demoButton}
            >
              <Text style={styles.demoButtonText}>Parent</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 6,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  passwordInputWrapper: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  eyeButton: {
    paddingVertical: 6,
    paddingLeft: 8,
  },
  loginButton: {
    marginTop: 4,
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
  demoSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
    textAlign: 'center',
  },
  demoButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  demoButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  demoButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
});

