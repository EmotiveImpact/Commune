import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'commune_theme_mode';

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: 'light',
  setMode: (mode) => {
    set({ mode });
    void AsyncStorage.setItem(STORAGE_KEY, mode);
  },
  toggle: () => {
    const next = get().mode === 'light' ? 'dark' : 'light';
    get().setMode(next);
  },
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      set({ mode: stored });
    }
  },
}));
