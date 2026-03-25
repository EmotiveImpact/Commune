import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GroupState {
  activeGroupId: string | null;
  hydrated: boolean;
  setActiveGroupId: (id: string | null) => void;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set) => ({
      activeGroupId: null,
      hydrated: false,
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
    }),
    {
      name: 'commune-active-group',
      partialize: (state) => ({ activeGroupId: state.activeGroupId }),
      onRehydrateStorage: () => () => {
        useGroupStore.setState({ hydrated: true });
      },
    }
  )
);
