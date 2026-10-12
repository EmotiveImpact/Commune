import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { StreetScene } from "./StreetScene";

export function ConnectionRecovery({ retry, signOut }: { retry: () => Promise<void>; signOut: () => Promise<void> }) {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  // The connection came back during a run: say so, and let the run finish.
  const [backOnline, setBackOnline] = useState(false);
  const playing = useRef(false);
  const inFlight = useRef(false);
  const retryRef = useRef(retry);
  retryRef.current = retry;

  async function reconnect() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setAttempted(false);
    setBackOnline(false);
    try { await retryRef.current(); }
    finally {
      inFlight.current = false;
      setBusy(false);
      setAttempted(true);
    }
  }

  useEffect(() => {
    const online = () => {
      setOffline(false);
      if (playing.current) setBackOnline(true); else void reconnect();
    };
    const offline = () => { setOffline(true); setBackOnline(false); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  return <StreetScene label="Street runner, a game to play while Commune reconnects" onPlayingChange={(now) => { playing.current = now; }}>
    <div aria-busy={busy}>
      <WifiOff className="c-street-icon" size={24} strokeWidth={1.5} aria-hidden="true" />
      <h1>{backOnline ? "You’re back online" : offline ? "You’re offline" : "We couldn’t connect"}</h1>
      <p>{backOnline ? "Commune is ready. Open it when you’ve finished your run." : offline ? "Check your internet connection. We’ll try again when you’re back online." : "We couldn’t check your account just now. Try again in a moment."}</p>
      <div className="c-street-actions">
        <button className="a-btn" type="button" disabled={busy || offline} onClick={() => void reconnect()}>{busy ? "Reconnecting…" : backOnline ? "Open Commune" : "Try again"}</button>
        {/* Signing out here also works offline: this device forgets the account straight away. */}
        <button className="a-btn ghost" type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
      </div>
      <div className="c-street-feedback" role="status">{attempted && !busy ? "Still unable to connect. Please try again shortly." : ""}</div>
    </div>
  </StreetScene>;
}
