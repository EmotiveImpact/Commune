import '../global.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSession,
  initSupabase,
  onAuthStateChange,
  type SupabaseAuthUser,
} from '@commune/api';
import type { User } from '@commune/types';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/lib/errors';

/* Minimal shimmer skeleton for the root bootstrap screen. Kept inline to avoid
   importing the full ui.tsx module before the app is ready. */
function BootstrapSkeleton() {
  const opacity = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ flex: 1, opacity, paddingTop: 60 }}>
      <View style={{ width: '100%', height: 200, borderRadius: 32, backgroundColor: 'rgba(23,27,36,0.08)' }} />
      <View style={{ height: 16 }} />
      <View style={{ width: '100%', height: 130, borderRadius: 26, backgroundColor: 'rgba(23,27,36,0.08)' }} />
      <View style={{ height: 12 }} />
      <View style={{ width: '100%', height: 180, borderRadius: 28, backgroundColor: 'rgba(23,27,36,0.08)' }} />
    </Animated.View>
  );
}

type ExpoExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const runtimeEnv =
  (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

function toMobileUser(user: SupabaseAuthUser | null): User | null {
  if (!user) {
    return null;
  }

  const meta = user.user_metadata ?? {};
  const fullName =
    typeof meta.name === 'string' && meta.name
      ? meta.name
      : user.email?.split('@')[0] ?? 'Commune user';

  return {
    id: user.id,
    email: user.email ?? '',
    name: fullName,
    first_name: typeof meta.first_name === 'string' ? meta.first_name : fullName.split(' ')[0] ?? '',
    last_name: typeof meta.last_name === 'string' ? meta.last_name : fullName.split(' ').slice(1).join(' '),
    avatar_url: typeof meta.avatar_url === 'string' ? meta.avatar_url : null,
    phone: typeof meta.phone === 'string' ? meta.phone : null,
    country: typeof meta.country === 'string' ? meta.country : null,
    default_currency: typeof meta.default_currency === 'string' ? meta.default_currency : 'GBP',
    timezone: typeof meta.timezone === 'string' ? meta.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone,
    created_at: user.created_at,
  };
}

export default function RootLayout() {
  const [bootstrapError, setBootstrapError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
  const supabaseUrl = useMemo(
    () => extra.supabaseUrl ?? runtimeEnv.EXPO_PUBLIC_SUPABASE_URL ?? '',
    [extra.supabaseUrl]
  );
  const supabaseAnonKey = useMemo(
    () => extra.supabaseAnonKey ?? runtimeEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    [extra.supabaseAnonKey]
  );
  const configError = !supabaseUrl || !supabaseAnonKey
    ? 'Missing mobile Supabase configuration. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in apps/mobile/.env and restart Expo.'
    : '';

  useEffect(() => {
    if (configError) {
      setLoading(false);
      setIsReady(true);
      return;
    }

    initSupabase(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    let isMounted = true;
    setLoading(true);

    async function bootstrapAuth() {
      try {
        const session = await getSession();
        if (!isMounted) return;
        setUser(toMobileUser(session?.user ?? null));
      } catch (error) {
        if (!isMounted) return;
        setBootstrapError(getErrorMessage(error, 'Could not initialize auth.'));
        setLoading(false);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    const {
      data: { subscription },
    } = onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(toMobileUser(session?.user ?? null));
      setIsReady(true);
    });

    void bootstrapAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [configError, setLoading, setUser, supabaseAnonKey, supabaseUrl]);

  useEffect(() => {
    if (!isReady || !navigationState?.key || configError) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [configError, isAuthenticated, isReady, navigationState?.key, router, segments]);

  if (configError || bootstrapError) {
    return (
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f1ea', paddingHorizontal: 24 }}>
            <Text className="mb-2 text-center text-xl font-semibold text-gray-900">
              Mobile app setup needed
            </Text>
            <Text className="text-center text-sm text-gray-500">
              {configError || bootstrapError}
            </Text>
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  if (!isReady || isLoading) {
    return (
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <View style={{ flex: 1, backgroundColor: '#f5f1ea', padding: 16 }}>
            <BootstrapSkeleton />
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: '#f5f1ea' },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#f5f1ea' },
            headerTintColor: '#171b24',
            headerTitleStyle: {
              fontWeight: '700',
            },
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{ title: 'Get Started', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="members"
            options={{ title: 'Members', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="group-edit"
            options={{ title: 'Edit Group', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="expenses/new"
            options={{ title: 'New Expense', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="expenses/[expenseId]"
            options={{ title: 'Expense Detail', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="expenses/[expenseId]/edit"
            options={{ title: 'Edit Expense', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="activity"
            options={{ title: 'Activity', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="notifications"
            options={{ title: 'Notifications', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="pricing"
            options={{ title: 'Pricing', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="recurring"
            options={{ title: 'Recurring', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="analytics"
            options={{ title: 'Analytics', headerBackTitle: 'Back' }}
          />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
