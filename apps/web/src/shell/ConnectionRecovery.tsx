import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import "./connection-recovery.css";

export function ConnectionRecovery({ retry, signOut }: { retry: () => Promise<void>; signOut: () => Promise<void> }) {
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const inFlight = useRef(false);
  const retryRef = useRef(retry);
  retryRef.current = retry;

  async function reconnect() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setAttempted(false);
    try { await retryRef.current(); }
    finally {
      inFlight.current = false;
      setBusy(false);
      setAttempted(true);
    }
  }

  useEffect(() => {
    const online = () => { setOffline(false); void reconnect(); };
    const offline = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  return <main className="a-body c-connection-recovery">
    <span className="a-wordmark">commune.</span>
    <section className="c-connection-card" aria-labelledby="connection-title" aria-busy={busy}>
      <WifiOff className="c-connection-icon" size={24} strokeWidth={1.5} aria-hidden="true" />
      <h1 id="connection-title">{offline ? "You’re offline" : "We couldn’t connect"}</h1>
      <p>{offline ? "Check your internet connection. We’ll try again when you’re back online." : "We couldn’t check your account just now. Try again in a moment."}</p>
      <div className="c-connection-actions">
        <button className="a-btn" type="button" disabled={busy || offline} onClick={() => void reconnect()}>{busy ? "Reconnecting…" : "Try again"}</button>
        {/* Signing out here also works offline: this device forgets the account straight away. */}
        <button className="a-btn ghost" type="button" disabled={busy} onClick={() => void signOut()}>Sign out</button>
      </div>
      <div className="c-connection-feedback" role="status">{attempted && !busy ? "Still unable to connect. Please try again shortly." : ""}</div>
    </section>
  </main>;
}
