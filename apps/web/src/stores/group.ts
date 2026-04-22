import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GroupState {
  activeGroupId: string | null;
  activeGroupUserId: string | null;
  setActiveGroupId: (id: string | null) => void;
  setActiveGroupUserId: (userId: string | null) => void;
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set) => ({
      activeGroupId: null,
      activeGroupUserId: null,
      setActiveGroupId: (activeGroupId) => set({ activeGroupId }),
      setActiveGroupUserId: (activeGroupUserId) => set({ activeGroupUserId }),
    }),
    {
      name: 'commune-active-group',
      partialize: (state) => ({
        activeGroupId: state.activeGroupId,
        activeGroupUserId: state.activeGroupUserId,
      }),
    }
  )
);
