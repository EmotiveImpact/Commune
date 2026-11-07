/**
 * Join codes (migration 0044): a QR code that needs no email. Whoever scans
 * it asks to join; what happens next is the commune's join setting, which only
 * an admin changes. The setting covers codes only: email invitations work as
 * they always have. People who join by code are always ordinary members.
 */
export type JoinMode = "approve" | "instant" | "off";
export type JoinCodeKind = "sticker" | "now";
export type JoinCode = { id: string; kind: JoinCodeKind; token: string; createdAt: string; expiresAt: string | null };
export type JoinRequest = { id: string; userId: string; name: string; email: string | null; createdAt: string; codeKind: JoinCodeKind };
export type JoinState = { joinMode: JoinMode; codes: JoinCode[]; requests: JoinRequest[] };
export type JoinCodePreview = {
  communeName: string; communeKind: "household" | "workspace" | "trip"; memberCount: number;
  joinMode: JoinMode; alreadyMember: boolean; waiting: boolean;
};
export type JoinResult = { status: "pending" | "joined" | "already_member" | "declined" | "cancelled"; requestId?: string; communeId?: string | null };

export const EMPTY_JOIN: JoinState = { joinMode: "approve", codes: [], requests: [] };

/** The three choices, as the invite page shows them. */
export const JOIN_MODES: Array<{ mode: JoinMode; label: string; line: string }> = [
  { mode: "approve", label: "Ask, then an admin approves", line: "Anyone who scans asks to join. They see nothing until an admin taps Approve." },
  { mode: "instant", label: "Join straight away", line: "Scanning adds them as a member at once." },
  { mode: "off", label: "Off (email invites only)", line: "Every QR code, join link and sticker stops working. Email invitations still do." },
];

/** Shown under "Join straight away", which lets anyone holding the code in. */
export const INSTANT_WARNING = "Anyone with the code, even from a photo of it, can see this group’s names, bills and balances.";

const SITE = "https://app.ourcommune.io";

/** The short link a code's QR carries. The app opens it; so does the website. */
export function joinCodeUrl(token: string): string {
  return `${SITE}/j/${token}`;
}

/** A join code token from a scanned or tapped link (https /j/<code>, /join?code=, or commune://join-code/<code>). */
export function tokenFromJoinLink(link: string): string | null {
  const match = /(?:\/j\/|join-code\/|[?&]code=)([0-9a-f]{32})(?:$|[/?#&])/.exec(link.trim());
  return match ? match[1] : null;
}

/** "Stops working at 13:05", or null for a sticker. */
export function expiryWords(code: JoinCode, now = new Date()): string | null {
  if (!code.expiresAt) return null;
  const end = new Date(code.expiresAt);
  const minutes = Math.round((end.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return "This code has stopped working";
  if (minutes < 60) return `Stops working in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  return "Stops working in an hour";
}

/** A code still working now. */
export function isLive(code: JoinCode, now = new Date()): boolean {
  return !code.expiresAt || new Date(code.expiresAt).getTime() > now.getTime();
}

/** "40 minutes ago", for when someone asked. */
export function askedWords(createdAt: string, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
