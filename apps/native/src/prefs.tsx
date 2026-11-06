import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Where the Hub's Overview, Money, Chores and Notes tabs sit. */
export type HubTabsAt = "top" | "bottom";

type Prefs = { hubTabsAt: HubTabsAt; setHubTabsAt(value: HubTabsAt): void };

const KEY = "commune.prefs.v1";
const Context = createContext<Prefs>({ hubTabsAt: "top", setHubTabsAt: () => undefined });

/** Choices kept on this phone only. They never reach the server. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [hubTabsAt, setValue] = useState<HubTabsAt>("top");
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY).then((raw) => {
      if (!live || !raw) return;
      const saved = JSON.parse(raw) as Partial<{ hubTabsAt: HubTabsAt }>;
      if (saved.hubTabsAt === "top" || saved.hubTabsAt === "bottom") setValue(saved.hubTabsAt);
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const setHubTabsAt = useCallback((value: HubTabsAt) => {
    setValue(value);
    AsyncStorage.setItem(KEY, JSON.stringify({ hubTabsAt: value })).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ hubTabsAt, setHubTabsAt }), [hubTabsAt, setHubTabsAt]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePrefs(): Prefs {
  return useContext(Context);
}
