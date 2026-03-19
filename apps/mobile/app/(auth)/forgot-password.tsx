import { useState } from 'react';
import {
  Alert,
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { resetPassword } from '@commune/api';
import { AppButton, TextField } from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      Alert.alert('Reset failed', getErrorMessage(err, 'Could not send reset link'));
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
            Reset password
          </Text>
          <Text className="mt-3 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
            Enter your email and we'll send you a reset link.
          </Text>
        </View>

        <View className="mt-4 rounded-[28px] border border-[rgba(23,27,36,0.14)] bg-white px-5 py-5">
          {sent ? (
            <>
              <Text className="text-2xl font-semibold text-[#171b24]">Check your email</Text>
              <Text className="mt-2 text-sm leading-6 text-[#667085]">
                We sent a password reset link to {email}. Follow the link to set a new password.
              </Text>

              <View className="mt-6 flex-row justify-center">
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text className="font-semibold text-[#2d6a4f]">Back to sign in</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </>
          ) : (
            <>
              <Text className="text-2xl font-semibold text-[#171b24]">Forgot your password?</Text>
              <Text className="mt-2 text-sm leading-6 text-[#667085]">
                No worries. Enter the email linked to your account and we'll send instructions.
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
              </View>

              <AppButton
                label={loading ? 'Sending...' : 'Send reset link'}
                onPress={handleReset}
                disabled={loading}
              />

              {loading ? (
                <View className="mt-4 flex-row items-center justify-center">
                  <ActivityIndicator color="#2d6a4f" />
                </View>
              ) : null}

              <View className="mt-5 flex-row justify-center">
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text className="font-semibold text-[#2d6a4f]">Back to sign in</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
