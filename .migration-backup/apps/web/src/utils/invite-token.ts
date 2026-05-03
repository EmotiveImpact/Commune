const INVITE_TOKEN_STORAGE_KEY = 'commune_invite_token';

function getStorage(kind: 'session' | 'local'): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function storePendingInviteToken(token: string): void {
  const value = token.trim();
  if (!value) {
    return;
  }

  getStorage('session')?.setItem(INVITE_TOKEN_STORAGE_KEY, value);
  getStorage('local')?.removeItem(INVITE_TOKEN_STORAGE_KEY);
}

export function consumePendingInviteToken(): string | null {
  const sessionStorage = getStorage('session');
  const localStorage = getStorage('local');
  const token =
    sessionStorage?.getItem(INVITE_TOKEN_STORAGE_KEY)
    ?? localStorage?.getItem(INVITE_TOKEN_STORAGE_KEY)
    ?? null;

  sessionStorage?.removeItem(INVITE_TOKEN_STORAGE_KEY);
  localStorage?.removeItem(INVITE_TOKEN_STORAGE_KEY);

  if (!token) {
    return null;
  }

  const value = token.trim();
  return value ? value : null;
}

export function clearPendingInviteToken(): void {
  getStorage('session')?.removeItem(INVITE_TOKEN_STORAGE_KEY);
  getStorage('local')?.removeItem(INVITE_TOKEN_STORAGE_KEY);
}
