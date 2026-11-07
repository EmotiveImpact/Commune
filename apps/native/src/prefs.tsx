import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Where the Hub's Overview, Money, Chores and Notes tabs sit. */
export type HubTabsAt = "top" | "bottom";

/**
 * The first-day checklist Home shows after joining a commune from an
 * invitation. Each step is ticked here as it is done; it stays until
 * dismissed.
 */
export type FirstDay = {
  communeId: string;
  communeName: string;
  partSeen: boolean;
  notifications: boolean;
  dismissed: boolean;
};

type Prefs = {
  hubTabsAt: HubTabsAt;
  setHubTabsAt(value: HubTabsAt): void;
  firstDay: FirstDay | null;
  /** Starts the checklist, or changes it. Pass null to forget it. */
  setFirstDay(value: FirstDay | null): void;
};

const PREFS_STORE = "commune.prefs.v1";
const FIRST_DAY_STORE = "commune.firstday.v1";
const Context = createContext<Prefs>({ hubTabsAt: "top", setHubTabsAt: () => undefined, firstDay: null, setFirstDay: () => undefined });

/** Choices kept on this phone only. They never reach the server. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [hubTabsAt, setValue] = useState<HubTabsAt>("top");
  const [firstDay, setFirstDayValue] = useState<FirstDay | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(PREFS_STORE).then((raw) => {
      if (!live || !raw) return;
      const saved = JSON.parse(raw) as Partial<{ hubTabsAt: HubTabsAt }>;
      if (saved.hubTabsAt === "top" || saved.hubTabsAt === "bottom") setValue(saved.hubTabsAt);
    }).catch(() => undefined);
    AsyncStorage.getItem(FIRST_DAY_STORE).then((raw) => {
      if (!live || !raw) return;
      const saved = JSON.parse(raw) as Partial<FirstDay>;
      if (typeof saved.communeId === "string" && typeof saved.communeName === "string") {
        setFirstDayValue({ communeId: saved.communeId, communeName: saved.communeName, partSeen: !!saved.partSeen, notifications: !!saved.notifications, dismissed: !!saved.dismissed });
      }
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const setHubTabsAt = useCallback((value: HubTabsAt) => {
    setValue(value);
    AsyncStorage.setItem(PREFS_STORE, JSON.stringify({ hubTabsAt: value })).catch(() => undefined);
  }, []);
  const setFirstDay = useCallback((value: FirstDay | null) => {
    setFirstDayValue(value);
    (value ? AsyncStorage.setItem(FIRST_DAY_STORE, JSON.stringify(value)) : AsyncStorage.removeItem(FIRST_DAY_STORE)).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ hubTabsAt, setHubTabsAt, firstDay, setFirstDay }), [hubTabsAt, setHubTabsAt, firstDay, setFirstDay]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePrefs(): Prefs {
  return useContext(Context);
}
