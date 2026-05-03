# Phase 7: Mobile App (Expo + React Native)

## Overview

Build the Commune mobile app using Expo SDK 53 + Expo Router v4, sharing the same Supabase backend and `@commune/*` packages as the web app. The mobile app provides core functionality — auth, dashboard, expenses, breakdown, and settings — in a native mobile experience styled with NativeWind v4.

## Critical Issues

1. `packages/api/src/client.ts` uses `import.meta.env.VITE_*` — not available in Expo (uses `process.env.EXPO_PUBLIC_*`)
2. `packages/api/src/auth.ts` uses `window.location.origin` — not available in React Native
3. The Supabase client must be configurable so both web and mobile can initialize it with their own env var patterns

## Architecture

- **Expo SDK 53** + **Expo Router v4** (file-based routing)
- **NativeWind v4** (Tailwind CSS for React Native)
- **TanStack Query v5** + **Zustand v5** (same pattern as web)
- Shared packages (`@commune/api`, `@commune/core`, `@commune/types`, `@commune/utils`) imported directly via pnpm workspace
- Supabase client initialized in mobile root layout, injected into API package via `initSupabase()`

---

## Task 1: Make API Client Configurable

Refactor `packages/api/src/client.ts` so the Supabase client can be initialized by the consuming app. Instead of reading env vars directly, export an `initSupabase(url, key)` function and a getter. Update `apps/web` entry to call `initSupabase()`.

### Changes

#### `packages/api/src/client.ts`

Replace the entire file with:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

/**
 * Initialize the Supabase client. Must be called once before using any API functions.
 * - Web: call from main.tsx with import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * - Mobile: call from root layout with process.env.EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
export function initSupabase(url: string, anonKey: string): SupabaseClient {
  _supabase = createClient(url, anonKey);
  return _supabase;
}

/**
 * Get the initialized Supabase client. Throws if initSupabase() has not been called.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      'Supabase not initialized. Call initSupabase(url, anonKey) before using any API functions.'
    );
  }
  return _supabase;
}

/**
 * @deprecated Use getSupabase() instead. Kept for backwards compatibility —
 * existing code that imports `supabase` from this module continues to work
 * as long as initSupabase() has been called before first access.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});
```

> All files in `packages/api/src/` that import `supabase` from `./client` continue to work unchanged via the Proxy.

#### `packages/api/src/index.ts`

Add the new exports (keep all existing exports):

```typescript
export { initSupabase, getSupabase } from './client';
```

#### `apps/web/src/main.tsx`

Add initialization before `ReactDOM.createRoot()`:

```typescript
import { initSupabase } from '@commune/api';

initSupabase(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

#### `packages/api/src/auth.ts`

Update OAuth and redirect-dependent functions to accept an optional `redirectUrl` parameter instead of hardcoding `window.location.origin`:

```typescript
export async function signInWithGoogle(redirectUrl?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl ?? `${window.location.origin}/callback`,
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithApple(redirectUrl?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: redirectUrl ?? `${window.location.origin}/callback`,
    },
  });
  if (error) throw error;
  return data;
}

export async function resetPassword(email: string, redirectUrl?: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl ?? `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}
```

### Commit

```
refactor: make supabase client configurable for multi-platform support
```

---

## Task 2: Scaffold Expo App

Create `apps/mobile/` with Expo SDK 53 + Expo Router v4 + NativeWind v4.

### Files

#### `apps/mobile/package.json`

```json
{
  "name": "@commune/mobile",
  "version": "0.0.1",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "build": "echo 'Use EAS Build for production builds'"
  },
  "dependencies": {
    "@commune/api": "workspace:*",
    "@commune/core": "workspace:*",
    "@commune/types": "workspace:*",
    "@commune/utils": "workspace:*",
    "@expo/vector-icons": "^14.0.0",
    "@react-native-async-storage/async-storage": "^2.1.0",
    "@react-navigation/native": "^7.0.0",
    "@supabase/supabase-js": "^2.49.0",
    "@tanstack/react-query": "^5.62.0",
    "expo": "~53.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-status-bar": "~2.0.0",
    "nativewind": "^4.1.0",
    "react": "^19.0.0",
    "react-native": "~0.79.0",
    "react-native-safe-area-context": "~5.4.0",
    "react-native-screens": "~4.10.0",
    "react-native-reanimated": "~3.17.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0"
  }
}
```

#### `apps/mobile/app.json`

```json
{
  "expo": {
    "name": "Commune",
    "slug": "commune",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "commune",
    "platforms": ["ios", "android"],
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.commune.app"
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#ffffff"
      },
      "package": "com.commune.app"
    },
    "plugins": ["expo-router", "expo-secure-store"]
  }
}
```

#### `apps/mobile/metro.config.js`

```javascript
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so changes in packages/* are picked up
config.watchFolders = [monorepoRoot];

// Resolve modules from both the app and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Prevent Metro from resolving packages outside explicit paths
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: './global.css' });
```

#### `apps/mobile/babel.config.js`

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

#### `apps/mobile/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
        surface: { DEFAULT: '#ffffff', secondary: '#f5f5f5' },
      },
    },
  },
  plugins: [],
};
```

#### `apps/mobile/global.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### `apps/mobile/nativewind-env.d.ts`

```typescript
/// <reference types="nativewind/types" />
```

#### `apps/mobile/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "nativewind-env.d.ts"
  ]
}
```

#### `apps/mobile/app/_layout.tsx`

```tsx
import '../global.css';
import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initSupabase, onAuthStateChange } from '@commune/api';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

const SUPABASE_URL =
  Constants.expoConfig?.extra?.supabaseUrl ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  '';
const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.supabaseAnonKey ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  '';

initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000 },
  },
});

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthenticated === null) return; // still loading

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Slot />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

### Commit

```
feat: scaffold Expo mobile app with router, NativeWind, and monorepo config
```

---

## Task 3: Auth Screens (Login + Signup)

### Files

#### `apps/mobile/app/(auth)/_layout.tsx`

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

#### `apps/mobile/app/(auth)/login.tsx`

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { signInWithEmail } from '@commune/api';

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
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-center mb-2">Commune</Text>
        <Text className="text-gray-500 text-center mb-8">
          Manage shared expenses together
        </Text>

        {error ? (
          <Text className="text-red-500 text-center mb-4">{error}</Text>
        ) : null}

        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 mb-3 text-base"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 mb-6 text-base"
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          className="bg-primary rounded-xl py-3.5 items-center mb-4"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Sign in</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-gray-500">Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text className="text-primary font-semibold">Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
```

#### `apps/mobile/app/(auth)/signup.tsx`

```tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link } from 'expo-router';
import { signUpWithEmail } from '@commune/api';

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
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-center mb-2">
          Create account
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          Join Commune to manage shared expenses
        </Text>

        {error ? (
          <Text className="text-red-500 text-center mb-4">{error}</Text>
        ) : null}

        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 mb-3 text-base"
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />

        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 mb-3 text-base"
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 mb-6 text-base"
          placeholder="Password (min. 8 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        <TouchableOpacity
          className="bg-primary rounded-xl py-3.5 items-center mb-4"
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Create account
            </Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center">
          <Text className="text-gray-500">Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="text-primary font-semibold">Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
```

### Commit

```
feat: add mobile auth screens with login and signup
```

---

## Task 4: Tab Navigation, Stores, Hooks, and Dashboard Screen

### Files

#### `apps/mobile/stores/auth.ts`

```typescript
import { create } from 'zustand';
import type { User } from '@commune/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

#### `apps/mobile/stores/group.ts`

```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist } from 'zustand/middleware';

interface GroupState {
  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set) => ({
      activeGroupId: null,
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
    }),
    {
      name: 'commune-active-group',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

#### `apps/mobile/hooks/use-dashboard.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getUserBreakdown } from '@commune/api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (groupId: string, userId: string, month: string) =>
    [...dashboardKeys.all, 'stats', groupId, userId, month] as const,
  breakdown: (groupId: string, userId: string, month: string) =>
    [...dashboardKeys.all, 'breakdown', groupId, userId, month] as const,
};

export function useDashboardStats(
  groupId: string,
  userId: string,
  month: string
) {
  return useQuery({
    queryKey: dashboardKeys.stats(groupId, userId, month),
    queryFn: () => getDashboardStats(groupId, userId, month),
    enabled: !!groupId && !!userId,
  });
}

export function useUserBreakdown(
  groupId: string,
  userId: string,
  month: string
) {
  return useQuery({
    queryKey: dashboardKeys.breakdown(groupId, userId, month),
    queryFn: () => getUserBreakdown(groupId, userId, month),
    enabled: !!groupId && !!userId,
  });
}
```

#### `apps/mobile/hooks/use-groups.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { getUserGroups, getGroup } from '@commune/api';

export const groupKeys = {
  all: ['groups'] as const,
  list: (userId: string) => [...groupKeys.all, 'list', userId] as const,
  detail: (groupId: string) =>
    [...groupKeys.all, 'detail', groupId] as const,
};

export function useUserGroups(userId: string) {
  return useQuery({
    queryKey: groupKeys.list(userId),
    queryFn: () => getUserGroups(userId),
    enabled: !!userId,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => getGroup(groupId),
    enabled: !!groupId,
  });
}
```

#### `apps/mobile/hooks/use-expenses.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGroupExpenses, getExpenseDetail, markPayment } from '@commune/api';

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (groupId: string) => [...expenseKeys.all, 'list', groupId] as const,
  detail: (id: string) => [...expenseKeys.all, 'detail', id] as const,
};

export function useGroupExpenses(groupId: string) {
  return useQuery({
    queryKey: expenseKeys.list(groupId),
    queryFn: () => getGroupExpenses(groupId),
    enabled: !!groupId,
  });
}

export function useExpenseDetail(expenseId: string) {
  return useQuery({
    queryKey: expenseKeys.detail(expenseId),
    queryFn: () => getExpenseDetail(expenseId),
    enabled: !!expenseId,
  });
}

export function useMarkPayment(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      expenseId: string;
      userId: string;
      status: string;
      note?: string;
    }) => markPayment(args.expenseId, args.userId, args.status, args.note),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: expenseKeys.detail(variables.expenseId),
      });
      queryClient.invalidateQueries({
        queryKey: expenseKeys.list(groupId),
      });
    },
  });
}
```

#### `apps/mobile/app/(tabs)/_layout.tsx`

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6366f1',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="breakdown"
        options={{
          title: 'Breakdown',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pie-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

#### `apps/mobile/app/(tabs)/index.tsx`

```tsx
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useDashboardStats } from '@/hooks/use-dashboard';
import { useUserGroups } from '@/hooks/use-groups';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const month = getCurrentMonth();

  const { data: groups, isLoading: groupsLoading } = useUserGroups(
    user?.id ?? ''
  );

  // Auto-select first group if none selected
  const groupId =
    activeGroupId ?? (groups && groups.length > 0 ? groups[0].id : '');

  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    groupId,
    user?.id ?? '',
    month
  );

  if (groupsLoading || statsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-xl font-semibold mb-2">Welcome to Commune</Text>
        <Text className="text-gray-500 text-center">
          You're not part of any group yet. Create or join a group to get
          started.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 py-4">
        <Text className="text-sm text-gray-500 mb-1">Current month</Text>
        <Text className="text-lg font-semibold mb-6">{month}</Text>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-surface-secondary rounded-2xl p-4">
            <Text className="text-sm text-gray-500 mb-1">Total expenses</Text>
            <Text className="text-xl font-bold">
              {formatCurrency(stats?.totalExpenses ?? 0)}
            </Text>
          </View>
          <View className="flex-1 bg-surface-secondary rounded-2xl p-4">
            <Text className="text-sm text-gray-500 mb-1">Your share</Text>
            <Text className="text-xl font-bold">
              {formatCurrency(stats?.yourShare ?? 0)}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-green-50 rounded-2xl p-4">
            <Text className="text-sm text-green-700 mb-1">You are owed</Text>
            <Text className="text-xl font-bold text-green-700">
              {formatCurrency(stats?.youAreOwed ?? 0)}
            </Text>
          </View>
          <View className="flex-1 bg-red-50 rounded-2xl p-4">
            <Text className="text-sm text-red-700 mb-1">You owe</Text>
            <Text className="text-xl font-bold text-red-700">
              {formatCurrency(stats?.youOwe ?? 0)}
            </Text>
          </View>
        </View>

        {/* Recent activity placeholder */}
        <Text className="text-lg font-semibold mb-3">Recent expenses</Text>
        <View className="bg-surface-secondary rounded-2xl p-4">
          <Text className="text-gray-500 text-center">
            Recent expenses will appear here
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
```

### Commit

```
feat: add tab navigation, stores, hooks, and dashboard screen
```

---

## Task 5: Expenses and Breakdown Screens

### Files

#### `apps/mobile/app/(tabs)/expenses.tsx`

```tsx
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroupExpenses } from '@/hooks/use-expenses';
import { useUserGroups } from '@/hooks/use-groups';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  created_at: string;
  paid_by_name: string;
}

export default function ExpensesScreen() {
  const user = useAuthStore((s) => s.user);
  const { activeGroupId } = useGroupStore();
  const { data: groups } = useUserGroups(user?.id ?? '');

  const groupId =
    activeGroupId ?? (groups && groups.length > 0 ? groups[0].id : '');

  const {
    data: expenses,
    isLoading,
    refetch,
    isRefetching,
  } = useGroupExpenses(groupId);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!expenses || expenses.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg font-semibold mb-2">No expenses yet</Text>
        <Text className="text-gray-500 text-center">
          Expenses added to this group will appear here.
        </Text>
      </View>
    );
  }

  const renderExpense = ({ item }: { item: Expense }) => (
    <TouchableOpacity className="flex-row items-center py-3 px-6 border-b border-gray-100">
      <View className="flex-1">
        <Text className="text-base font-medium">{item.description}</Text>
        <Text className="text-sm text-gray-500">
          {item.paid_by_name} &middot; {formatDate(item.created_at)}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-base font-semibold">
          {formatCurrency(item.amount)}
        </Text>
        <Text className="text-xs text-gray-400">{item.category}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      className="flex-1 bg-white"
      data={expenses}
      keyExtractor={(item) => item.id}
      renderItem={renderExpense}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor="#6366f1"
        />
      }
    />
  );
}
```

#### `apps/mobile/app/(tabs)/breakdown.tsx`

```tsx
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useUserBreakdown } from '@/hooks/use-dashboard';
import { useUserGroups } from '@/hooks/use-groups';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

interface BreakdownItem {
  category: string;
  total: number;
  percentage: number;
}

export default function BreakdownScreen() {
  const user = useAuthStore((s) => s.user);
  const { activeGroupId } = useGroupStore();
  const { data: groups } = useUserGroups(user?.id ?? '');
  const month = getCurrentMonth();

  const groupId =
    activeGroupId ?? (groups && groups.length > 0 ? groups[0].id : '');

  const { data: breakdown, isLoading } = useUserBreakdown(
    groupId,
    user?.id ?? '',
    month
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (
    !breakdown ||
    !breakdown.categories ||
    breakdown.categories.length === 0
  ) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-lg font-semibold mb-2">No data yet</Text>
        <Text className="text-gray-500 text-center">
          Your spending breakdown will appear here once expenses are added.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 py-4">
        <Text className="text-sm text-gray-500 mb-1">Breakdown for</Text>
        <Text className="text-lg font-semibold mb-6">{month}</Text>

        {breakdown.categories.map((item: BreakdownItem) => (
          <View key={item.category} className="mb-4">
            <View className="flex-row justify-between mb-1">
              <Text className="text-base font-medium">{item.category}</Text>
              <Text className="text-base font-semibold">
                {formatCurrency(item.total)}
              </Text>
            </View>

            {/* Progress bar */}
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
              />
            </View>

            <Text className="text-xs text-gray-400 mt-1">
              {item.percentage.toFixed(1)}% of total
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
```

### Commit

```
feat: add expenses list and breakdown screens
```

---

## Task 6: Settings Screen

### Files

#### `apps/mobile/app/(tabs)/settings.tsx`

```tsx
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { signOut } from '@commune/api';
import { useGroupStore } from '@/stores/group';
import { useQueryClient } from '@tanstack/react-query';

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setActiveGroupId = useGroupStore((s) => s.setActiveGroupId);
  const queryClient = useQueryClient();

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            setUser(null);
            setActiveGroupId(null);
            queryClient.clear();
          } catch (err) {
            Alert.alert(
              'Error',
              err instanceof Error ? err.message : 'Failed to sign out'
            );
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-white">
      {/* Profile section */}
      <View className="px-6 py-6 border-b border-gray-100">
        <View className="w-16 h-16 bg-primary rounded-full items-center justify-center mb-3">
          <Text className="text-white text-2xl font-bold">
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text className="text-xl font-semibold">{user?.name ?? 'User'}</Text>
        <Text className="text-gray-500">{user?.email ?? ''}</Text>
      </View>

      {/* Menu items */}
      <View className="px-6 py-4">
        <TouchableOpacity className="py-4 border-b border-gray-100">
          <Text className="text-base">Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity className="py-4 border-b border-gray-100">
          <Text className="text-base">About</Text>
        </TouchableOpacity>

        <TouchableOpacity className="py-4" onPress={handleSignOut}>
          <Text className="text-base text-red-500">Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Version */}
      <View className="absolute bottom-8 left-0 right-0 items-center">
        <Text className="text-gray-400 text-sm">Commune v1.0.0</Text>
      </View>
    </View>
  );
}
```

### Commit

```
feat: add settings screen with profile and sign out
```

---

## Task 7: Build Verification

Run these checks to verify the implementation compiles and integrates correctly:

```bash
# 1. Run core package tests
pnpm --filter @commune/api test
pnpm --filter @commune/core test
pnpm --filter @commune/utils test

# 2. Verify web app still builds (after client.ts refactor)
pnpm --filter @commune/web build

# 3. Verify mobile app compiles (without needing a device)
cd apps/mobile && npx expo export --platform web

# 4. Type-check mobile app
cd apps/mobile && npx tsc --noEmit

# 5. Review git log
git log --oneline -10
```

**Expected output:** All tests pass, web build succeeds, Expo export completes without errors, type-check passes.

---

## File Inventory

| File | Action | Task |
|------|--------|------|
| `packages/api/src/client.ts` | Modify | 1 |
| `packages/api/src/index.ts` | Modify | 1 |
| `packages/api/src/auth.ts` | Modify | 1 |
| `apps/web/src/main.tsx` | Modify | 1 |
| `apps/mobile/package.json` | Create | 2 |
| `apps/mobile/app.json` | Create | 2 |
| `apps/mobile/tsconfig.json` | Create | 2 |
| `apps/mobile/babel.config.js` | Create | 2 |
| `apps/mobile/metro.config.js` | Create | 2 |
| `apps/mobile/tailwind.config.js` | Create | 2 |
| `apps/mobile/global.css` | Create | 2 |
| `apps/mobile/nativewind-env.d.ts` | Create | 2 |
| `apps/mobile/app/_layout.tsx` | Create | 2 |
| `apps/mobile/app/(auth)/_layout.tsx` | Create | 3 |
| `apps/mobile/app/(auth)/login.tsx` | Create | 3 |
| `apps/mobile/app/(auth)/signup.tsx` | Create | 3 |
| `apps/mobile/stores/auth.ts` | Create | 4 |
| `apps/mobile/stores/group.ts` | Create | 4 |
| `apps/mobile/hooks/use-dashboard.ts` | Create | 4 |
| `apps/mobile/hooks/use-groups.ts` | Create | 4 |
| `apps/mobile/hooks/use-expenses.ts` | Create | 4 |
| `apps/mobile/app/(tabs)/_layout.tsx` | Create | 4 |
| `apps/mobile/app/(tabs)/index.tsx` | Create | 4 |
| `apps/mobile/app/(tabs)/expenses.tsx` | Create | 5 |
| `apps/mobile/app/(tabs)/breakdown.tsx` | Create | 5 |
| `apps/mobile/app/(tabs)/settings.tsx` | Create | 6 |

## Commit Sequence

1. `refactor: make supabase client configurable for multi-platform support`
2. `feat: scaffold Expo mobile app with router, NativeWind, and monorepo config`
3. `feat: add mobile auth screens with login and signup`
4. `feat: add tab navigation, stores, hooks, and dashboard screen`
5. `feat: add expenses list and breakdown screens`
6. `feat: add settings screen with profile and sign out`
