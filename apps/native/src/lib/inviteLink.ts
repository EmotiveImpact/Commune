/** Where invitation links point: the web address works for anyone, and opens the app when it is installed. */
export const JOIN_BASE = "https://app.ourcommune.io/join/";

/** The invitation token from any link the server hands back (…/join/<token> or …?token=<token>). */
export function inviteToken(url: string): string | null {
  const query = /[?&]token=([^&#]+)/.exec(url);
  if (query) return decodeURIComponent(query[1]);
  const path = /\/join\/([^/?#]+)/.exec(url);
  return path ? decodeURIComponent(path[1]) : null;
}

/** The link to share: https://app.ourcommune.io/join/<token>, or the server's own link when it has no token. */
export function shareLink(url: string): string {
  const token = inviteToken(url);
  return token ? JOIN_BASE + encodeURIComponent(token) : url;
}
