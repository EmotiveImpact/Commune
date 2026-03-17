import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    }
  )
);
