import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { signInWithGoogle, signUpWithEmail } from '@commune/api';
import { AppButton, TextField } from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

export default function SignupScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSignup() {
    if (!firstName || !lastName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await signUpWithEmail(email, password, fullName);
    } catch (err) {
      setError(getErrorMessage(err, 'Sign up failed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(getErrorMessage(err, 'Google sign-up failed'));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#f5f1ea]"
      style={{ flex: 1, backgroundColor: '#f5f1ea' }}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Crescent logo mark */}
        <View className="mb-6 items-center">
          <View
            className="h-16 w-16 items-center justify-center rounded-full bg-[#1f2330]"
          >
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFFFFF' }}>C</Text>
          </View>
          <Text className="mt-3 text-lg font-semibold text-[#1f2330]">Commune</Text>
        </View>

        {/* Signup card */}
        <View className="rounded-[28px] border border-[rgba(23,27,36,0.14)] bg-white px-6 py-6">
          <Text className="text-center text-2xl font-bold text-[#171b24]">
            Create your account
          </Text>
          <Text className="mt-2 text-center text-sm leading-6 text-[#667085]">
            Join Commune to track shared costs without the confusion.
          </Text>

          {error ? (
            <View className="mt-4 rounded-2xl bg-[#FCE7E4] px-4 py-3">
              <Text className="text-sm font-medium text-[#B9382F]">{error}</Text>
            </View>
          ) : null}

          <View className="mt-5">
            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1">
                <TextField
                  label="First name"
                  placeholder="Jane"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoComplete="given-name"
                />
              </View>
              <View className="flex-1">
                <TextField
                  label="Last name"
                  placeholder="Doe"
                  value={lastName}
                  onChangeText={setLastName}
                  autoComplete="family-name"
                />
              </View>
            </View>

            <TextField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <TextField
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <AppButton
            label={loading ? 'Creating account...' : 'Create account'}
            onPress={handleSignup}
            disabled={loading}
          />

          {loading ? (
            <View className="mt-4 flex-row items-center justify-center">
              <ActivityIndicator color="#2d6a4f" />
            </View>
          ) : null}

          {/* Divider */}
          <View className="my-5 flex-row items-center">
            <View className="flex-1 border-b border-[rgba(23,27,36,0.10)]" />
            <Text className="mx-4 text-xs font-medium text-[#667085]">OR</Text>
            <View className="flex-1 border-b border-[rgba(23,27,36,0.10)]" />
          </View>

          {/* Google sign-up */}
          <TouchableOpacity
            className="min-h-[52px] flex-row items-center justify-center rounded-2xl border border-[rgba(23,27,36,0.14)] bg-white px-4"
            activeOpacity={0.86}
            onPress={handleGoogleSignUp}
            disabled={googleLoading}
            style={googleLoading ? { opacity: 0.6 } : undefined}
          >
            {googleLoading ? (
              <ActivityIndicator color="#171b24" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#171b24" style={{ marginRight: 10 }} />
                <Text className="text-base font-semibold text-[#171b24]">
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-[#667085]">Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="font-semibold text-[#2d6a4f]">Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
