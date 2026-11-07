import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * What the opening flow keeps on this phone: whether it has been played,
 * which stories were seen (so none repeats), and what the story card and
 * free week card on Home need.
 */
export type OpeningSaved = {
  done: boolean;
  seen: string[];
  /** The story the person saw, for the story card on an empty Home. */
  storyId: string | null;
  /** The commune made at the end of the opening. */
  communeId: string | null;
  /** The day the free week started (yyyy-mm-dd), and the plan picked. */
  trialStart: string | null;
  plan: string | null;
  /** The story card was closed. */
  storyCardClosed: boolean;
};

const KEY = "commune.opening.v1";
const EMPTY: OpeningSaved = { done: false, seen: [], storyId: null, communeId: null, trialStart: null, plan: null, storyCardClosed: false };

export function readOpening(raw: string | null): OpeningSaved {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw) as Partial<OpeningSaved>;
    return {
      done: !!v.done,
      seen: Array.isArray(v.seen) ? v.seen.filter((x): x is string => typeof x === "string").slice(-40) : [],
      storyId: typeof v.storyId === "string" ? v.storyId : null,
      communeId: typeof v.communeId === "string" ? v.communeId : null,
      trialStart: typeof v.trialStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trialStart) ? v.trialStart : null,
      plan: typeof v.plan === "string" ? v.plan : null,
      storyCardClosed: !!v.storyCardClosed,
    };
  } catch { return EMPTY; }
}

type Opening = OpeningSaved & { loaded: boolean; save(patch: Partial<OpeningSaved>): void };
const Context = createContext<Opening>({ ...EMPTY, loaded: false, save: () => undefined });

export function OpeningProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<OpeningSaved>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY).then((raw) => { if (live) setSaved(readOpening(raw)); }).catch(() => undefined).finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, []);
  const save = useCallback((patch: Partial<OpeningSaved>) => {
    setSaved((now) => {
      const next = { ...now, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ ...saved, loaded, save }), [saved, loaded, save]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useOpening = () => useContext(Context);

/** Day N of the free week, from 1 to 7, or null once it is over or never started. */
export function trialDay(start: string | null, today: string): number | null {
  if (!start) return null;
  const days = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${start}T12:00:00`)) / 86400000);
  return days >= 0 && days < 7 ? days + 1 : null;
}
