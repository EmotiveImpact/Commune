export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (import.meta.env.PROD) {
    const { neonApi } = await import("./neon");
    return neonApi<T>(path, init);
  }
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers,
  });
  let body: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else if (response.status !== 204) {
    body = await response.text();
  }
  if (response.ok && response.status !== 204 && !contentType.includes("application/json")) {
    throw new ApiError("Commune's application service did not return JSON", 502);
  }
  if (!response.ok) {
    const error = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const message = typeof error?.error === "string"
      ? error.error
      : typeof error?.message === "string"
        ? error.message
        : typeof body === "string" && body.length < 240
          ? body
          : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export function post<T>(path: string, payload: unknown): Promise<T> {
  return api<T>(path, { method: "POST", body: JSON.stringify(payload) });
}
