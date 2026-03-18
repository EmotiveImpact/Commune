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
import { signUpWithEmail } from '@commune/api';
import { AppButton, TextField } from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!name || !email || !password) {
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
      await signUpWithEmail(email, password, name);
    } catch (err) {
      setError(getErrorMessage(err, 'Sign up failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#F4EFE8]"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="rounded-[32px] bg-[#17141F] px-5 py-6">
          <Text className="text-sm font-medium text-[#BBB4C1]">Create your account</Text>
          <Text className="mt-2 text-[32px] font-bold leading-[38px] text-white">
            Start one clear space for shared money.
          </Text>
          <Text className="mt-3 text-sm leading-6 text-[#C7C2CD]">
            Join Commune to track communal costs without the clutter and confusion.
          </Text>
        </View>

        <View className="mt-4 rounded-[28px] border border-[#DED6CA] bg-white px-5 py-5">
          <Text className="text-2xl font-semibold text-[#17141F]">Create account</Text>
          <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
            Set up your login details and get to your first group.
          </Text>

          {error ? (
            <View className="mt-4 rounded-[20px] bg-[#FCE7E4] px-4 py-3">
              <Text className="text-sm font-medium text-[#B9382F]">{error}</Text>
            </View>
          ) : null}

          <View className="mt-5">
            <TextField
              label="Full name"
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />

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
              <ActivityIndicator color="#205C54" />
            </View>
          ) : null}

          <View className="mt-5 flex-row justify-center">
            <Text className="text-[#6A645D]">Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="font-semibold text-[#205C54]">Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
