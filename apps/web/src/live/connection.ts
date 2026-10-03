/** Only connection failures are retryable. Validation and access failures are not. */
export function isConnectionFailure(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number(error.status);
    return status === 408 || status === 502 || status === 503 || status === 504;
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /failed to fetch|fetch failed|network(?:error| request failed| unavailable)|load failed|offline/i.test(message);
}
