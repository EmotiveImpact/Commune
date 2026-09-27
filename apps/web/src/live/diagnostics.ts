// Opt-in, browser-local diagnostics. Never record URLs, headers, bodies, IDs,
// names, email addresses, tokens, or database error messages.
export function diagnosticsEnabled() {
  return typeof location !== "undefined" && new URLSearchParams(location.search).get("diagnostics") === "1";
}

export function reportRead(resource: string, started: number, status: number | string) {
  const durationMs = Math.round(performance.now() - started);
  if (diagnosticsEnabled() || status === "network-error" || (typeof status === "number" && status >= 400)) {
    console.info("[commune:request]", JSON.stringify({ resource, durationMs, status }));
  }
}

export const observedDataFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const match = url.pathname.match(/\/rest\/v1\/(rpc\/)?([a-z][a-z0-9_]*)$/);
  const resource = match ? `${match[1] ?? ""}${match[2]}` : "data";
  const started = performance.now();
  try {
    const response = await fetch(input, init);
    reportRead(resource, started, response.status);
    return response;
  } catch (error) {
    reportRead(resource, started, "network-error");
    throw error;
  }
};
