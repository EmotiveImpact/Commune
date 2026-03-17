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
