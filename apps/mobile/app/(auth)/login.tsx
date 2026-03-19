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
import { Link } from 'expo-router';
import { signInWithEmail } from '@commune/api';
import { AppButton, TextField } from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#f5f1ea]"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="rounded-[32px] bg-[#1f2330] px-5 py-6">
          <Text className="text-sm font-medium text-[rgba(255,255,255,0.72)]">Commune</Text>
          <Text className="mt-2 text-[32px] font-bold leading-[38px] text-white">
            Shared expenses, laid out clearly.
          </Text>
          <Text className="mt-3 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
            Sign in to check balances, keep payments moving, and stay on top of your groups.
          </Text>
        </View>

        <View className="mt-4 rounded-[28px] border border-[rgba(23,27,36,0.14)] bg-white px-5 py-5">
          <Text className="text-2xl font-semibold text-[#171b24]">Welcome back</Text>
          <Text className="mt-2 text-sm leading-6 text-[#667085]">
            Pick up where the latest group changes left off.
          </Text>

          {error ? (
            <View className="mt-4 rounded-[20px] bg-[#FCE7E4] px-4 py-3">
              <Text className="text-sm font-medium text-[#B9382F]">{error}</Text>
            </View>
          ) : null}

          <View className="mt-5">
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
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <View className="mb-4 flex-row justify-end">
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity>
                <Text className="text-sm font-medium text-[#667085]">Forgot password?</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <AppButton
            label={loading ? 'Signing in...' : 'Sign in'}
            onPress={handleLogin}
            disabled={loading}
          />

          {loading ? (
            <View className="mt-4 flex-row items-center justify-center">
              <ActivityIndicator color="#2d6a4f" />
            </View>
          ) : null}

          <View className="mt-5 flex-row justify-center">
            <Text className="text-[#667085]">Don't have an account? </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text className="font-semibold text-[#2d6a4f]">Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
