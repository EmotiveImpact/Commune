// Browser storage can be full (photos are large), blocked by a privacy
// setting or missing. Losing a saved preference is better than failing the
// action that wanted to save it, so these never throw.

export function readStored(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Whether the value was kept. */
export function writeStored(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing could have been stored either.
  }
}
