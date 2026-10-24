import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '@/services/AuthContext';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

const p = Colors.palette;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register } = useAuth();

  const handleAuth = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (isRegistering && !name.trim()) {
      setError('Name is required for registration');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        await register(email.trim(), name.trim());
      } else {
        try {
          await login(email.trim());
        } catch (loginError: any) {
          // If not registered yet, auto-create player account seamlessly
          const defaultName = email.trim().split('@')[0] || 'VectorBat Player';
          await register(email.trim(), defaultName);
        }
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    try {
      try {
        await login('demo@vectorbat.com');
      } catch (e) {
        await register('demo@vectorbat.com', 'Vector Pro Player');
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.formContainer}>
        {/* Accent line at top */}
        <View style={styles.accentLine} />

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="hardware-chip-outline" size={36} color={Colors.primary} />
          </View>
          <Text style={styles.title}>VectorBat</Text>
          <Text style={styles.subtitle}>Smart Cricket Analytics</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={[styles.input, email ? styles.inputFocused : null]}
            placeholder="player@example.com"
            placeholderTextColor={p.textSubtle}
            value={email}
            onChangeText={(text) => { setEmail(text); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {isRegistering && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, name ? styles.inputFocused : null]}
              placeholder="e.g. Virat Kohli"
              placeholderTextColor={p.textSubtle}
              value={name}
              onChangeText={(text) => { setName(text); setError(''); }}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              {isRegistering ? 'Create Account' : 'Log In'}
            </Text>
          )}
        </Pressable>

        {/* 1-Tap Instant Demo Access */}
        <Pressable 
          style={{
            marginTop: 10,
            backgroundColor: 'rgba(0, 201, 123, 0.1)',
            borderWidth: 1,
            borderColor: '#00C97B',
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          }}
          onPress={handleDemoLogin}
          disabled={loading}
        >
          <Ionicons name="flash" size={16} color="#00C97B" />
          <Text style={{ color: '#00C97B', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>
            QUICK DEMO ACCESS (1-TAP)
          </Text>
        </Pressable>

        <Pressable 
          style={styles.switchModeBtn} 
          onPress={() => { setIsRegistering(!isRegistering); setError(''); }}
          disabled={loading}
        >
          <Text style={styles.switchModeText}>
            {isRegistering 
              ? 'Already have an account? Log In' 
              : "Don't have an account? Sign Up"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: p.base,
    justifyContent: 'center',
    padding: 24,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: p.surface,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: p.glassBorder,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    }),
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.primary,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
    marginTop: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1.5,
    borderColor: Colors.primary + '25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: p.textPrimary,
    marginTop: 16,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: p.textMuted,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: p.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: p.glassBorderLight,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: p.textPrimary,
    backgroundColor: p.surfaceElevated,
  },
  inputFocused: {
    borderColor: Colors.primary + '50',
    backgroundColor: p.surface,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    ...(Platform.OS === 'web' ? {
      boxShadow: `0 4px 16px ${Colors.primary}35`,
    } : {}),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  switchModeBtn: {
    marginTop: 24,
    alignItems: 'center',
    padding: 8,
  },
  switchModeText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: p.danger,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
});
