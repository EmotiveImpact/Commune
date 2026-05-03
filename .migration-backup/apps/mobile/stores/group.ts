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
