import type { QueryClient } from '@tanstack/react-query';

type ObservabilityKind = 'api' | 'route' | 'query';

interface ObservabilitySample {
  kind: ObservabilityKind;
  label: string;
  durationMs: number;
  status?: number;
  ok?: boolean;
  timestamp: string;
  meta?: Record<string, unknown>;
}

interface ObservabilitySummary {
  activeQueryFetches: number;
  totalQueryFetches: number;
  warmQueryFetches: number;
  coldQueryFetches: number;
  queryCacheSize: number;
}

interface ObservabilityBuffer {
  api: ObservabilitySample[];
  route: ObservabilitySample[];
  query: ObservabilitySample[];
  summary: ObservabilitySummary;
}

declare global {
  interface Window {
    __COMMUNE_OBSERVABILITY__?: ObservabilityBuffer;
  }
}

const env = import.meta.env as Record<string, string | boolean | undefined>;
const OBSERVABILITY_ENABLED =
  import.meta.env.DEV || env.VITE_ENABLE_WEB_OBSERVABILITY === 'true';
const API_SLOW_MS = Number(env.VITE_API_SLOW_MS ?? 800);
const ROUTE_SLOW_MS = Number(env.VITE_ROUTE_SLOW_MS ?? 250);
const QUERY_SLOW_MS = Number(env.VITE_QUERY_SLOW_MS ?? 600);
const OBSERVABILITY_BUFFER_LIMIT = 100;

function getBuffer(): ObservabilityBuffer | null {
  if (typeof window === 'undefined' || !OBSERVABILITY_ENABLED) {
    return null;
  }

  if (!window.__COMMUNE_OBSERVABILITY__) {
    window.__COMMUNE_OBSERVABILITY__ = {
      api: [],
      route: [],
      query: [],
      summary: {
        activeQueryFetches: 0,
        totalQueryFetches: 0,
        warmQueryFetches: 0,
        coldQueryFetches: 0,
        queryCacheSize: 0,
      },
    };
  }

  return window.__COMMUNE_OBSERVABILITY__;
}

function compactUrlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function recordSample(sample: ObservabilitySample): void {
  const buffer = getBuffer();
  if (!buffer) return;

  const bucket = buffer[sample.kind];
  bucket.push(sample);
  if (bucket.length > OBSERVABILITY_BUFFER_LIMIT) {
    bucket.splice(0, bucket.length - OBSERVABILITY_BUFFER_LIMIT);
  }

  window.dispatchEvent(
    new CustomEvent('commune:observability', {
      detail: sample,
    }),
  );

  const resolvedThreshold =
    sample.kind === 'api'
      ? API_SLOW_MS
      : sample.kind === 'route'
        ? ROUTE_SLOW_MS
        : QUERY_SLOW_MS;
  const shouldLog = sample.durationMs >= resolvedThreshold || sample.ok === false;
  if (shouldLog) {
    console.warn(
      `[commune:${sample.kind}] ${sample.label} ${sample.durationMs.toFixed(1)}ms`,
      sample,
    );
  }
}

export function createObservedFetch(
  fetchImpl: typeof fetch,
  options?: { apiBaseUrl?: string },
): typeof fetch {
  return async (input, init) => {
    if (!OBSERVABILITY_ENABLED) {
      return fetchImpl(input, init);
    }

    const url = resolveFetchUrl(input);
    if (options?.apiBaseUrl && !url.startsWith(options.apiBaseUrl)) {
      return fetchImpl(input, init);
    }

    const startedAt = performance.now();

    try {
      const response = await fetchImpl(input, init);
      recordSample({
        kind: 'api',
        label: compactUrlPath(url),
        durationMs: performance.now() - startedAt,
        status: response.status,
        ok: response.ok,
        timestamp: new Date().toISOString(),
      });
      return response;
    } catch (error) {
      recordSample({
        kind: 'api',
        label: compactUrlPath(url),
        durationMs: performance.now() - startedAt,
        ok: false,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  };
}

export function recordRoutePaint(label: string, durationMs: number): void {
  if (!OBSERVABILITY_ENABLED) return;

  recordSample({
    kind: 'route',
    label,
    durationMs,
    ok: true,
    timestamp: new Date().toISOString(),
  });
}

export function getObservabilitySnapshot(): ObservabilityBuffer | null {
  return getBuffer();
}

function formatQueryLabel(queryKey: unknown): string {
  if (Array.isArray(queryKey)) {
    return queryKey
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part === 'number' || typeof part === 'boolean') return String(part);
        if (part && typeof part === 'object') return '{...}';
        return 'unknown';
      })
      .join(':');
  }

  if (typeof queryKey === 'string') {
    return queryKey;
  }

  return 'query';
}

interface ObservedQueryLike {
  queryHash: string;
  queryKey: unknown;
  state: {
    fetchStatus?: string;
    status?: string;
    dataUpdatedAt?: number;
    errorUpdateCount?: number;
  };
}

interface QueryFetchTracker {
  startedAt: number;
  warmStart: boolean;
}

export function instrumentQueryClient(queryClient: QueryClient): () => void {
  if (!OBSERVABILITY_ENABLED || typeof window === 'undefined') {
    return () => {};
  }

  const buffer = getBuffer();
  if (!buffer) {
    return () => {};
  }

  const inFlight = new Map<string, QueryFetchTracker>();
  const queryCache = queryClient.getQueryCache();

  return queryCache.subscribe((event) => {
    const query = (event as { query?: ObservedQueryLike }).query;
    buffer.summary.queryCacheSize = queryCache.getAll().length;

    if (!query) {
      return;
    }

    const fetchStatus = query.state.fetchStatus;
    const queryHash = query.queryHash;

    if (fetchStatus === 'fetching') {
      if (!inFlight.has(queryHash)) {
        inFlight.set(queryHash, {
          startedAt: performance.now(),
          warmStart:
            (query.state.dataUpdatedAt ?? 0) > 0 || query.state.status === 'success',
        });
        buffer.summary.activeQueryFetches = inFlight.size;
      }
      return;
    }

    const trackedFetch = inFlight.get(queryHash);
    if (!trackedFetch) {
      return;
    }

    inFlight.delete(queryHash);
    buffer.summary.activeQueryFetches = inFlight.size;
    buffer.summary.totalQueryFetches += 1;
    if (trackedFetch.warmStart) {
      buffer.summary.warmQueryFetches += 1;
    } else {
      buffer.summary.coldQueryFetches += 1;
    }

    recordSample({
      kind: 'query',
      label: formatQueryLabel(query.queryKey),
      durationMs: performance.now() - trackedFetch.startedAt,
      ok: query.state.status !== 'error',
      timestamp: new Date().toISOString(),
      meta: {
        warmStart: trackedFetch.warmStart,
        fetchStatus,
        status: query.state.status,
        errorUpdates: query.state.errorUpdateCount ?? 0,
      },
    });
  });
}
