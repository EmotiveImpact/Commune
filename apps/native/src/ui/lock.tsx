import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScanFace } from "lucide-react-native";
import { unlock } from "../lib/faceId";
import { shouldRelock } from "../lib/prefsStore";
import { usePrefs } from "../prefs";
import { Button } from "./kit";
import { Text } from "./text";
import { useTheme } from "./theme";

/**
 * Settings > Unlock with Face ID. When it is on, Commune opens behind this
 * cover and asks for Face ID; it asks again after a minute away.
 */
export function LockGate() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { faceId, loaded } = usePrefs();
  const [locked, setLocked] = useState(true);
  const [asking, setAsking] = useState(false);
  const awaySince = useRef<number | null>(null);
  const started = useRef(false);

  const ask = useCallback(async () => {
    setAsking(true);
    try { if (await unlock()) setLocked(false); } finally { setAsking(false); }
  }, []);

  // On a cold start: locked only if Face ID is on, and ask straight away.
  useEffect(() => {
    if (!loaded || started.current) return;
    started.current = true;
    if (faceId) void ask(); else setLocked(false);
  }, [loaded, faceId, ask]);

  // Turning it off in Settings unlocks; coming back after a minute locks again.
  useEffect(() => { if (loaded && !faceId) setLocked(false); }, [loaded, faceId]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") { if (awaySince.current == null) awaySince.current = Date.now(); return; }
      const away = awaySince.current;
      awaySince.current = null;
      if (faceId && shouldRelock(away, Date.now())) { setLocked(true); void ask(); }
    });
    return () => sub.remove();
  }, [faceId, ask]);

  if (loaded && !locked) return null;
  return <View accessibilityViewIsModal style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.frame, alignItems: "center", justifyContent: "center", paddingBottom: insets.bottom, zIndex: 1000 }}>
    {loaded && faceId ? <View style={{ alignItems: "center", gap: 28 }}>
      <Text accessibilityRole="header" style={{ color: c.onFrame, fontSize: 40, fontFamily: "CommuneWordmark36", letterSpacing: -2 }}>commune.</Text>
      <ScanFace size={40} color={c.onFrame2} strokeWidth={1.5} />
      <Button onFrame label="Unlock" busy={asking} onPress={() => void ask()} />
    </View> : null}
  </View>;
}
