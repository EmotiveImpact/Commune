import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { signInWithEmail, signInWithGoogle } from '@commune/api';
import { getErrorMessage } from '@/lib/errors';
import { hapticLight, hapticMedium, hapticWarning, hapticError } from '@/lib/haptics';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleLogin() {
    hapticMedium();
    if (!email || !password) {
      hapticWarning();
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      hapticError();
      setError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    hapticMedium();
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      hapticError();
      setError(getErrorMessage(err, 'Google sign-in failed'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#FFFFFF' }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          justifyContent: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Branding */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: '700',
              color: '#2d6a4f',
            }}
          >
            Commune
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 16,
              color: '#9CA3AF',
            }}
          >
            Welcome back
          </Text>
        </View>

        {/* Card */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          {error ? (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: '#DC2626',
                  fontWeight: '500',
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 8,
              }}
            >
              Email
            </Text>
            <TextInput
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                height: 50,
                paddingHorizontal: 16,
                fontSize: 15,
                color: '#171b24',
              }}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {/* Password */}
          <View style={{ marginBottom: 8 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 8,
              }}
            >
              Password
            </Text>
            <TextInput
              style={{
                backgroundColor: '#F3F4F6',
                borderRadius: 12,
                height: 50,
                paddingHorizontal: 16,
                fontSize: 15,
                color: '#171b24',
              }}
              placeholder="Your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          {/* Forgot password */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              marginBottom: 20,
            }}
          >
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity onPress={hapticLight}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#2d6a4f',
                  }}
                >
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Sign in button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#1f2330',
              height: 52,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
            ) : null}
            <Text
              style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '600',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginVertical: 24,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
            <Text
              style={{
                marginHorizontal: 16,
                fontSize: 13,
                fontWeight: '500',
                color: '#9CA3AF',
              }}
            >
              or
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
          </View>

          {/* Google button */}
          <TouchableOpacity
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#FFFFFF',
              height: 52,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              opacity: googleLoading ? 0.7 : 1,
            }}
          >
            {googleLoading ? (
              <ActivityIndicator color="#374151" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons
                name="logo-google"
                size={18}
                color="#374151"
                style={{ marginRight: 10 }}
              />
            )}
            <Text
              style={{
                color: '#374151',
                fontSize: 16,
                fontWeight: '600',
              }}
            >
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          {/* Sign up link */}
          <View
            style={{
              marginTop: 28,
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>
              Don't have an account?{' '}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity onPress={hapticLight}>
                <Text
                  style={{
                    fontWeight: '600',
                    color: '#2d6a4f',
                    fontSize: 14,
                  }}
                >
                  Sign up
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
