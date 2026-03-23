import { useState } from 'react';
import {
  Alert,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { updatePassword } from '@commune/api';
import { getErrorMessage } from '@/lib/errors';
import { hapticMedium, hapticSuccess, hapticWarning, hapticError } from '@/lib/haptics';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUpdate() {
    hapticMedium();
    if (!password || !confirmPassword) {
      hapticWarning();
      setError('Please fill in both fields');
      return;
    }
    if (password.length < 8) {
      hapticWarning();
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      hapticWarning();
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await updatePassword(password);
      hapticSuccess();
      Alert.alert('Password updated', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      hapticError();
      setError(getErrorMessage(err, 'Could not update password'));
    } finally {
      setLoading(false);
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
            Set a new password
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
          <Text
            style={{
              textAlign: 'center',
              fontSize: 20,
              fontWeight: '700',
              color: '#171b24',
            }}
          >
            New password
          </Text>
          <Text
            style={{
              marginTop: 8,
              textAlign: 'center',
              fontSize: 15,
              lineHeight: 22,
              color: '#9CA3AF',
            }}
          >
            Your new password must be at least 8 characters long.
          </Text>

          {error ? (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 12,
                padding: 12,
                marginTop: 16,
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

          {/* New password */}
          <View style={{ marginTop: 20, marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 8,
              }}
            >
              New password
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
              placeholder="At least 8 characters"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          {/* Confirm password */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: '#374151',
                marginBottom: 8,
              }}
            >
              Confirm password
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
              placeholder="Re-enter your password"
              placeholderTextColor="#9CA3AF"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          {/* Update password button */}
          <TouchableOpacity
            onPress={handleUpdate}
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
              {loading ? 'Updating...' : 'Update password'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
