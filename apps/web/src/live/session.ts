// Every tab of the app shares one sign-in, but each keeps its own copy of
// whose data it is showing. These helpers keep the two in step: a tab that
// signs in or out tells the others, and every request names the account on
// screen so the server never acts for someone the tab is not showing.

export const ACCOUNT_CHANGED = "You signed out or changed account in another tab, so this wasn’t saved.";

let viewer: string | null = null;

/** The account whose data this tab shows, or null when signed out. */
export function setViewer(userId: string | null): void {
  viewer = userId;
}

export function currentViewer(): string | null {
  return viewer;
}

type SessionMessage = { type: "session"; userId: string | null };
const CHANNEL = "commune.session";
let channel: BroadcastChannel | null | undefined;

function sessionChannel(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL);
  }
  return channel;
}

/** Tell the other tabs that this one signed in as userId, or signed out. */
export function announceSession(userId: string | null): void {
  try {
    sessionChannel()?.postMessage({ type: "session", userId } satisfies SessionMessage);
  } catch {
    // A tab that cannot be told still checks the account on every request.
  }
}

/** Listen for sign-ins and sign-outs in other tabs. */
export function onOtherTabSession(listener: (userId: string | null) => void): () => void {
  const target = sessionChannel();
  if (!target) return () => undefined;
  const handle = (event: MessageEvent) => {
    const message = event.data as Partial<SessionMessage> | null;
    if (message?.type !== "session") return;
    listener(typeof message.userId === "string" ? message.userId : null);
  };
  target.addEventListener("message", handle);
  return () => target.removeEventListener("message", handle);
}
