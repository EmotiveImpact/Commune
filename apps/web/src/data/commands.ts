/**
 * How a failed write is described. A 4xx is the server's decision: nothing
 * was saved. Anything else (offline, timeout, 5xx) leaves the outcome
 * unknown; commands that carry a request id are then safe to retry.
 */
export function commandFailure(error: unknown, fallback: string): { message: string; rejected: boolean; conflict: boolean } {
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 0;
  const message = error instanceof Error && error.message ? error.message : fallback;
  if (status >= 400 && status < 500) return { message, rejected: true, conflict: status === 409 };
  return { message: "", rejected: false, conflict: false };
}

export const UNCERTAIN_RETRY_SAFE =
  "We could not confirm whether this was saved. Check your connection and try again. Trying again will not record it twice.";
