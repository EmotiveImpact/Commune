import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sortedValues.length) - 1),
  );
  return sortedValues[index];
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeBaseUrl(input) {
  const value = input ?? process.env.COMMUNE_LOAD_BASE_URL;
  if (!value) {
    throw new Error(
      'Missing base URL. Pass it as the first argument or set COMMUNE_LOAD_BASE_URL.',
    );
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function buildHeaders() {
  const headers = {
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Cache-Control': 'no-cache',
  };

  if (process.env.COMMUNE_LOAD_COOKIE) {
    headers.Cookie = process.env.COMMUNE_LOAD_COOKIE;
  }

  if (process.env.COMMUNE_LOAD_AUTHORIZATION) {
    headers.Authorization = process.env.COMMUNE_LOAD_AUTHORIZATION;
  }

  return headers;
}

async function loadBudgets() {
  const filePath = resolve(process.cwd(), 'load', 'budgets.json');
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function executeScenario(baseUrl, headers, scenario) {
  const hasAuth = Boolean(headers.Cookie || headers.Authorization);
  if (scenario.requiresAuth && !hasAuth) {
    return {
      name: scenario.name,
      skipped: true,
      reason: 'requires auth',
    };
  }

  const durations = [];
  const payloadBytes = [];
  const statuses = new Map();
  const contentTypes = new Map();
  const redirectTargets = new Map();
  let failures = 0;
  let redirects = 0;

  let cursor = 0;
  async function runOne(index) {
    const startedAt = performance.now();
    try {
      const response = await fetch(`${baseUrl}${scenario.path}`, {
        method: 'GET',
        headers,
        redirect: 'manual',
      });
      const durationMs = performance.now() - startedAt;
      durations.push(durationMs);
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      const contentType = response.headers.get('content-type') ?? 'unknown';
      contentTypes.set(contentType, (contentTypes.get(contentType) ?? 0) + 1);
      const location = response.headers.get('location');

      const body = await response.arrayBuffer();
      const bytes = body.byteLength;
      payloadBytes.push(bytes);

      const ok = response.status >= 200 && response.status < 400;
      const isRedirect = response.status >= 300 && response.status < 400;
      if (isRedirect) {
        redirects += 1;
        if (location) {
          redirectTargets.set(location, (redirectTargets.get(location) ?? 0) + 1);
        }
      }
      if (!ok) {
        failures += 1;
      }

      return { index, durationMs, status: response.status, ok, bytes, contentType, location };
    } catch {
      const durationMs = performance.now() - startedAt;
      durations.push(durationMs);
      payloadBytes.push(0);
      failures += 1;
      statuses.set(0, (statuses.get(0) ?? 0) + 1);
      return { index, durationMs, status: 0, ok: false, bytes: 0, contentType: 'error' };
    }
  }

  async function worker() {
    while (cursor < scenario.requests) {
      const current = cursor;
      cursor += 1;
      await runOne(current);
    }
  }

  await Promise.all(
    Array.from({ length: scenario.concurrency }, () => worker()),
  );

  durations.sort((a, b) => a - b);
  payloadBytes.sort((a, b) => a - b);

  const requestCount = durations.length;
  const errorRate = requestCount === 0 ? 0 : failures / requestCount;
  const redirectRate = requestCount === 0 ? 0 : redirects / requestCount;
  const p95 = percentile(durations, 95);
  const p50 = percentile(durations, 50);
  const avg = average(durations);
  const bytesP95 = percentile(payloadBytes, 95);
  const bytesP50 = percentile(payloadBytes, 50);
  const bytesAvg = average(payloadBytes);
  const passed =
    p95 <= scenario.budgetMsP95 &&
    errorRate <= scenario.maxErrorRate &&
    (scenario.budgetBytesP95 == null || bytesP95 <= scenario.budgetBytesP95);

  return {
    name: scenario.name,
    skipped: false,
    path: scenario.path,
    requestCount,
    p50,
    p95,
    avg,
    bytesP50,
    bytesP95,
    bytesAvg,
    errorRate,
    redirectRate,
    statuses: Object.fromEntries(statuses),
    contentTypes: Object.fromEntries(contentTypes),
    redirectTargets: Object.fromEntries(redirectTargets),
    passed,
    budgetMsP95: scenario.budgetMsP95,
    budgetBytesP95: scenario.budgetBytesP95 ?? null,
    maxErrorRate: scenario.maxErrorRate,
  };
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.argv[2]);
  const headers = buildHeaders();
  const config = await loadBudgets();

  const results = [];
  for (const scenario of config.scenarios) {
    const result = await executeScenario(baseUrl, headers, scenario);
    results.push(result);

    if (result.skipped) {
      console.log(`SKIP ${result.name} (${result.reason})`);
      continue;
    }

    console.log(
      [
        result.passed ? 'PASS' : 'FAIL',
        result.name,
        `p50=${result.p50.toFixed(1)}ms`,
        `p95=${result.p95.toFixed(1)}ms`,
        `avg=${result.avg.toFixed(1)}ms`,
        `bytesP95=${result.bytesP95}`,
        `errorRate=${(result.errorRate * 100).toFixed(2)}%`,
        `redirectRate=${(result.redirectRate * 100).toFixed(2)}%`,
        result.redirectRate > 0 && Object.keys(result.redirectTargets).length > 0
          ? `redirectTo=${Object.entries(result.redirectTargets).sort((a, b) => b[1] - a[1])[0]?.[0]}`
          : null,
      ].join(' | '),
    );
  }

  const failed = results.filter((result) => !result.skipped && !result.passed);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
