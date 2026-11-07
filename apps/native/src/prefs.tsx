import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance as RNAppearance, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_SAVED, readPrefs, type Appearance, type HubTabsAt, type NotifyKind, type RemindHour, type Saved } from "./lib/prefsStore";

export type { Appearance, HubTabsAt, NotifyKind, RemindHour } from "./lib/prefsStore";
export { NOTIFY_KINDS } from "./lib/prefsStore";

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

type Prefs = Saved & {
  loaded: boolean;
  setHubTabsAt(value: HubTabsAt): void;
  setAppearance(value: Appearance): void;
  setFaceId(value: boolean): void;
  setNotify(kind: NotifyKind, on: boolean): void;
  setRemindHour(value: RemindHour): void;
  setDisplayName(value: string | null): void;
  firstDay: FirstDay | null;
  /** Starts the checklist, or changes it. Pass null to forget it. */
  setFirstDay(value: FirstDay | null): void;
};

const PREFS_STORE = "commune.prefs.v1";
const FIRST_DAY_STORE = "commune.firstday.v1";
const DEFAULTS: Saved = DEFAULT_SAVED;
const noop = () => undefined;
const Context = createContext<Prefs>({ ...DEFAULTS, loaded: false, setHubTabsAt: noop, setAppearance: noop, setFaceId: noop, setNotify: noop, setRemindHour: noop, setDisplayName: noop, firstDay: null, setFirstDay: noop });

/** Choices kept on this phone only. They never reach the server. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [firstDay, setFirstDayValue] = useState<FirstDay | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(PREFS_STORE).then((raw) => {
      if (live) setSaved(readPrefs(raw));
    }).catch(() => undefined).finally(() => { if (live) setLoaded(true); });
    AsyncStorage.getItem(FIRST_DAY_STORE).then((raw) => {
      if (!live || !raw) return;
      const stored = JSON.parse(raw) as Partial<FirstDay>;
      if (typeof stored.communeId === "string" && typeof stored.communeName === "string") {
        setFirstDayValue({ communeId: stored.communeId, communeName: stored.communeName, partSeen: !!stored.partSeen, notifications: !!stored.notifications, dismissed: !!stored.dismissed });
      }
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  // Light or Dark overrides the phone for the whole app, system parts such as switches included.
  useEffect(() => {
    if (Platform.OS === "web") return;
    try { RNAppearance.setColorScheme(saved.appearance === "match" ? null : saved.appearance); } catch { /* older runtimes */ }
  }, [saved.appearance]);
  const change = useCallback((patch: Partial<Saved>) => {
    setSaved((now) => {
      const next = { ...now, ...patch };
      AsyncStorage.setItem(PREFS_STORE, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);
  const setFirstDay = useCallback((value: FirstDay | null) => {
    setFirstDayValue(value);
    (value ? AsyncStorage.setItem(FIRST_DAY_STORE, JSON.stringify(value)) : AsyncStorage.removeItem(FIRST_DAY_STORE)).catch(() => undefined);
  }, []);
  const value = useMemo<Prefs>(() => ({
    ...saved, loaded, firstDay, setFirstDay,
    setHubTabsAt: (hubTabsAt) => change({ hubTabsAt }),
    setAppearance: (appearance) => change({ appearance }),
    setFaceId: (faceId) => change({ faceId }),
    setNotify: (kind, on) => change({ notify: { ...saved.notify, [kind]: on } }),
    setRemindHour: (remindHour) => change({ remindHour }),
    setDisplayName: (name) => change({ displayName: name && name.trim() ? name.trim().slice(0, 48) : null }),
  }), [saved, loaded, change, firstDay, setFirstDay]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePrefs(): Prefs {
  return useContext(Context);
}
