import { useState } from 'react';
import {
  Alert,
  ScrollView,
  View,
  Text,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { resetPassword } from '@commune/api';
import { getErrorMessage } from '@/lib/errors';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning, hapticError } from '@/lib/haptics';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    hapticMedium();
    if (!email) {
      hapticWarning();
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      hapticSuccess();
      setSent(true);
    } catch (err) {
      hapticError();
      Alert.alert('Reset failed', getErrorMessage(err, 'Could not send reset link'));
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
            Reset your password
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
          {sent ? (
            <>
              {/* Success icon */}
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#ECFDF5',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 28 }}>✓</Text>
                </View>
              </View>

              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#171b24',
                }}
              >
                Check your email
              </Text>
              <Text
                style={{
                  marginTop: 12,
                  textAlign: 'center',
                  fontSize: 15,
                  lineHeight: 22,
                  color: '#9CA3AF',
                }}
              >
                We sent a password reset link to{' '}
                <Text style={{ fontWeight: '600', color: '#374151' }}>
                  {email}
                </Text>
                . Follow the link to set a new password.
              </Text>

              <Link href="/(auth)/login" asChild>
                <TouchableOpacity
                  onPress={hapticLight}
                  activeOpacity={0.8}
                  style={{
                    marginTop: 28,
                    backgroundColor: '#1f2330',
                    height: 52,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                  >
                    Back to sign in
                  </Text>
                </TouchableOpacity>
              </Link>
            </>
          ) : (
            <>
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#171b24',
                }}
              >
                Forgot your password?
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
                No worries. Enter the email linked to your account and we'll
                send instructions.
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

              {/* Email */}
              <View style={{ marginTop: 20, marginBottom: 24 }}>
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

              {/* Send reset link button */}
              <TouchableOpacity
                onPress={handleReset}
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
                  <ActivityIndicator
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                ) : null}
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </Text>
              </TouchableOpacity>

              {/* Back to sign in */}
              <View
                style={{
                  marginTop: 24,
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity onPress={hapticLight}>
                    <Text
                      style={{
                        fontWeight: '600',
                        color: '#2d6a4f',
                        fontSize: 14,
                      }}
                    >
                      Back to sign in
                    </Text>
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
