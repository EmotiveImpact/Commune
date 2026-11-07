import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance as RNAppearance, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_NOTIFY, readPrefs, type Appearance, type HubTabsAt, type NotifyKind, type Saved } from "./lib/prefsStore";

export type { Appearance, HubTabsAt, NotifyKind } from "./lib/prefsStore";
export { NOTIFY_KINDS } from "./lib/prefsStore";

type Prefs = Saved & {
  loaded: boolean;
  setHubTabsAt(value: HubTabsAt): void;
  setAppearance(value: Appearance): void;
  setFaceId(value: boolean): void;
  setNotify(kind: NotifyKind, on: boolean): void;
};

const PREFS_STORE = "commune.prefs.v1";
const DEFAULTS: Saved = { hubTabsAt: "top", appearance: "match", faceId: false, notify: DEFAULT_NOTIFY };
const noop = () => undefined;
const Context = createContext<Prefs>({ ...DEFAULTS, loaded: false, setHubTabsAt: noop, setAppearance: noop, setFaceId: noop, setNotify: noop });

/** Choices kept on this phone only. They never reach the server. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(PREFS_STORE).then((raw) => {
      if (live) setSaved(readPrefs(raw));
    }).catch(() => undefined).finally(() => { if (live) setLoaded(true); });
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
  const value = useMemo<Prefs>(() => ({
    ...saved, loaded,
    setHubTabsAt: (hubTabsAt) => change({ hubTabsAt }),
    setAppearance: (appearance) => change({ appearance }),
    setFaceId: (faceId) => change({ faceId }),
    setNotify: (kind, on) => change({ notify: { ...saved.notify, [kind]: on } }),
  }), [saved, loaded, change]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePrefs(): Prefs {
  return useContext(Context);
}
