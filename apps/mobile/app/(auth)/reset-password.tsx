import { useState } from 'react';
import {
  Alert,
  ScrollView,
  View,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { updatePassword } from '@commune/api';
import { AppButton, TextField } from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    if (!password || !confirmPassword) {
      setError('Please fill in both fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update password'));
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
            New password
          </Text>
          <Text className="mt-3 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
            Choose a strong password for your account.
          </Text>
        </View>

        <View className="mt-4 rounded-[28px] border border-[rgba(23,27,36,0.14)] bg-white px-5 py-5">
          <Text className="text-2xl font-semibold text-[#171b24]">Set new password</Text>
          <Text className="mt-2 text-sm leading-6 text-[#667085]">
            Your new password must be at least 8 characters long.
          </Text>

          {error ? (
            <View className="mt-4 rounded-[20px] bg-[#FCE7E4] px-4 py-3">
              <Text className="text-sm font-medium text-[#B9382F]">{error}</Text>
            </View>
          ) : null}

          <View className="mt-5">
            <TextField
              label="New password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            <TextField
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <AppButton
            label={loading ? 'Updating...' : 'Update password'}
            onPress={handleUpdate}
            disabled={loading}
          />

          {loading ? (
            <View className="mt-4 flex-row items-center justify-center">
              <ActivityIndicator color="#2d6a4f" />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
