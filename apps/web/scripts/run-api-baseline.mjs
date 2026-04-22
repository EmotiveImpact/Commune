import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function percentile(sortedValues, percentileValue) {
  if (sortedValues.length === 0) return null;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sortedValues.length) - 1),
  );
  return sortedValues[index];
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeBaseUrl(input) {
  const value = input ?? process.argv.slice(2).find((arg) => arg !== '--') ?? process.env.COMMUNE_LOAD_BASE_URL;
  if (!value) {
    throw new Error('Missing base URL. Pass it as the first argument or set COMMUNE_LOAD_BASE_URL.');
  }
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

async function readLocalEnv() {
  const envPath = resolve(process.cwd(), '.env');
  const raw = await readFile(envPath, 'utf8');
  const values = {};

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    values[key] = value;
  }

  return values;
}

async function loadApiConfig() {
  const filePath = resolve(process.cwd(), 'load', 'api-budgets.json');
  const raw = await readFile(filePath, 'utf8');
  const config = JSON.parse(raw);
  const profileName = process.env.COMMUNE_LOAD_PROFILE ?? config.defaultProfile ?? 'deployed';
  const baseProfile = config.profiles?.[profileName];

  if (!baseProfile) {
    const names = Object.keys(config.profiles ?? {});
    throw new Error(`Unknown API baseline profile "${profileName}". Available: ${names.join(', ') || 'none'}.`);
  }

  const scenarioFilter = process.env.COMMUNE_LOAD_ONLY
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!scenarioFilter?.length) {
    return { profileName, profile: baseProfile };
  }

  const scenarios = baseProfile.scenarios.filter((scenario) => scenarioFilter.includes(scenario.name));
  if (scenarios.length === 0) {
    throw new Error(
      `COMMUNE_LOAD_ONLY did not match any scenarios in profile "${profileName}". Requested: ${scenarioFilter.join(', ')}.`,
    );
  }

  return {
    profileName,
    profile: {
      ...baseProfile,
      gating: false,
      scenarios,
    },
  };
}

function buildProjectHeaders(anonKey, accessToken) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Prefer: 'count=exact',
  };

  return headers;
}

async function loginWithPassword(baseUrl, anonKey, email, password) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const durationMs = performance.now() - startedAt;
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok || !data?.access_token || !data?.user?.id) {
    throw new Error(`Password login failed (${response.status}): ${text.slice(0, 300)}`);
  }

  return {
    durationMs,
    data,
  };
}

function getMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function resolveContext(baseUrl, anonKey, email, password) {
  const auth = await loginWithPassword(baseUrl, anonKey, email, password);
  const accessToken = auth.data.access_token;
  const userId = auth.data.user.id;
  const headers = buildProjectHeaders(anonKey, accessToken);
  const month = getMonthKey();

  const bootstrapResponse = await fetch(`${baseUrl}/rest/v1/rpc/fn_get_signed_in_bootstrap`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_month: month,
      p_include_dashboard_summary: false,
    }),
  });

  const bootstrapText = await bootstrapResponse.text();
  const bootstrap = bootstrapText ? JSON.parse(bootstrapText) : null;
  if (!bootstrapResponse.ok || !bootstrap?.resolved_group_id || !Array.isArray(bootstrap?.groups)) {
    throw new Error(`Bootstrap context failed (${bootstrapResponse.status}): ${bootstrapText.slice(0, 300)}`);
  }

  const groups = bootstrap.groups;
  const resolvedGroupId = bootstrap.resolved_group_id;
  const resolvedGroup = groups.find((group) => group.id === resolvedGroupId) ?? groups[0] ?? null;
  const alternateGroup = groups.find((group) => group.id !== resolvedGroupId) ?? null;

  return {
    baseUrl,
    anonKey,
    accessToken,
    userId,
    month,
    resolvedGroupId,
    alternateGroupId: alternateGroup?.id ?? null,
    isWorkspaceGroup: resolvedGroup?.type === 'workspace',
    groups,
    authDurationMs: auth.durationMs,
  };
}

function interpolateToken(value, context) {
  if (typeof value !== 'string') return value;
  return value
    .replaceAll('$resolvedGroupId', context.resolvedGroupId ?? '')
    .replaceAll('$alternateGroupId', context.alternateGroupId ?? '')
    .replaceAll('$userId', context.userId)
    .replaceAll('$month', context.month)
    .replaceAll('$isWorkspaceGroup', String(context.isWorkspaceGroup));
}

function resolveTemplate(input, context) {
  if (Array.isArray(input)) {
    return input.map((item) => resolveTemplate(item, context));
  }
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, resolveTemplate(value, context)]),
    );
  }
  return interpolateToken(input, context);
}

function buildScenarioRequest(scenario, context) {
  if (scenario.type === 'auth-password') {
    return {
      method: 'POST',
      url: `${context.baseUrl}/auth/v1/token?grant_type=password`,
      headers: {
        apikey: context.anonKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: process.env.COMMUNE_LOAD_EMAIL,
        password: process.env.COMMUNE_LOAD_PASSWORD,
      }),
      label: 'auth-password',
    };
  }

  if (scenario.type === 'rpc') {
    return {
      method: 'POST',
      url: `${context.baseUrl}/rest/v1/rpc/${scenario.rpc}`,
      headers: buildProjectHeaders(context.anonKey, context.accessToken),
      body: JSON.stringify(resolveTemplate(scenario.body ?? {}, context)),
      label: scenario.rpc,
    };
  }

  if (scenario.type === 'rest') {
    const params = new URLSearchParams();
    const query = resolveTemplate(scenario.query ?? {}, context);
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === '') continue;
      params.set(key, String(value));
    }

    return {
      method: scenario.method ?? 'GET',
      url: `${context.baseUrl}${scenario.path}?${params.toString()}`,
      headers: buildProjectHeaders(context.anonKey, context.accessToken),
      body: null,
      label: scenario.path,
    };
  }

  throw new Error(`Unsupported API baseline scenario type "${scenario.type}".`);
}

function withScenarioOverrides(scenario) {
  const concurrencyOverride = Number(process.env.COMMUNE_LOAD_CONCURRENCY);
  const requestsOverride = Number(process.env.COMMUNE_LOAD_REQUESTS);
  const warmupConcurrencyOverride = Number(process.env.COMMUNE_LOAD_WARMUP_CONCURRENCY);
  const warmupRequestsOverride = Number(process.env.COMMUNE_LOAD_WARMUP_REQUESTS);

  return {
    ...scenario,
    concurrency: Number.isFinite(concurrencyOverride) && concurrencyOverride > 0
      ? concurrencyOverride
      : scenario.concurrency,
    requests: Number.isFinite(requestsOverride) && requestsOverride > 0
      ? requestsOverride
      : scenario.requests,
    warmupConcurrency:
      Number.isFinite(warmupConcurrencyOverride) && warmupConcurrencyOverride > 0
        ? warmupConcurrencyOverride
        : scenario.warmupConcurrency,
    warmupRequests:
      Number.isFinite(warmupRequestsOverride) && warmupRequestsOverride >= 0
        ? warmupRequestsOverride
        : scenario.warmupRequests,
  };
}

async function executeScenario(scenario, context) {
  if (scenario.requiresAuth && !context.accessToken) {
    return { name: scenario.name, skipped: true, reason: 'requires auth' };
  }

  if (scenario.requiresAlternateGroup && !context.alternateGroupId) {
    return { name: scenario.name, skipped: true, reason: 'requires an alternate group' };
  }

  const durations = [];
  const statuses = new Map();
  const sizes = [];
  const failureSamples = [];
  let failures = 0;
  let transportFailures = 0;
  let httpFailures = 0;
  let cursor = 0;

  async function runOne(recordMetrics = true) {
    const request = buildScenarioRequest(scenario, context);
    const startedAt = performance.now();

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      const durationMs = performance.now() - startedAt;
      const text = await response.text();
      if (recordMetrics) {
        durations.push(durationMs);
        sizes.push(text.length);
        statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      }

      if (!response.ok) {
        if (recordMetrics) {
          failures += 1;
          httpFailures += 1;
          failureSamples.push({
            status: response.status,
            body: text.slice(0, 200),
          });
        }
      }
    } catch (error) {
      const durationMs = performance.now() - startedAt;
      if (recordMetrics) {
        durations.push(durationMs);
        sizes.push(0);
        statuses.set(0, (statuses.get(0) ?? 0) + 1);
        failures += 1;
        transportFailures += 1;
        failureSamples.push({
          status: 0,
          body:
            error instanceof Error
              ? [
                  error.name,
                  error.message,
                  error.cause && typeof error.cause === 'object' && 'code' in error.cause
                    ? String(error.cause.code)
                    : null,
                  error.cause && typeof error.cause === 'object' && 'message' in error.cause
                    ? String(error.cause.message)
                    : null,
                ]
                  .filter(Boolean)
                  .join(' | ')
              : String(error),
        });
      }
    }
  }

  async function worker(totalRequests, recordMetrics) {
    while (cursor < totalRequests) {
      cursor += 1;
      await runOne(recordMetrics);
    }
  }

  const warmupRequests = scenario.warmupRequests ?? 0;
  const warmupConcurrency = scenario.warmupConcurrency ?? Math.min(scenario.concurrency, warmupRequests || 0);
  if (warmupRequests > 0 && warmupConcurrency > 0) {
    cursor = 0;
    await Promise.all(
      Array.from({ length: warmupConcurrency }, () => worker(warmupRequests, false)),
    );
  }

  cursor = 0;
  await Promise.all(Array.from({ length: scenario.concurrency }, () => worker(scenario.requests, true)));

  durations.sort((a, b) => a - b);
  sizes.sort((a, b) => a - b);
  const requestCount = durations.length;
  const errorRate = requestCount === 0 ? 0 : failures / requestCount;
  const p95 = percentile(durations, 95);
  const p50 = percentile(durations, 50);
  const sizeP95 = percentile(sizes, 95);
  const passed = (p95 ?? 0) <= scenario.budgetMsP95 && errorRate <= scenario.maxErrorRate;

  return {
    name: scenario.name,
    skipped: false,
    requestCount,
    p50,
    p95,
    avg: average(durations),
    sizeP95,
    errorRate,
    transportFailures,
    httpFailures,
    statuses: Object.fromEntries(statuses),
    failures: failureSamples.slice(0, 5),
    passed,
    budgetMsP95: scenario.budgetMsP95,
    maxErrorRate: scenario.maxErrorRate,
  };
}

async function writeReport(outputPath, report) {
  const normalizedOutput =
    process.cwd().endsWith('/apps/web') && outputPath.startsWith('apps/web/')
      ? outputPath.slice('apps/web/'.length)
      : outputPath;
  const resolvedOutput = resolve(process.cwd(), normalizedOutput);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, JSON.stringify(report, null, 2));
  console.log(`REPORT | ${resolvedOutput}`);
}

async function main() {
  const baseUrl = normalizeBaseUrl();
  const env = await readLocalEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.COMMUNE_LOAD_EMAIL;
  const password = process.env.COMMUNE_LOAD_PASSWORD;

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in apps/web/.env.');
  }
  if (!email || !password) {
    throw new Error('Missing COMMUNE_LOAD_EMAIL or COMMUNE_LOAD_PASSWORD.');
  }

  const { profileName, profile } = await loadApiConfig();
  const context = await resolveContext(supabaseUrl, anonKey, email, password);

  const results = [];
  for (const scenario of profile.scenarios) {
    const result = await executeScenario(withScenarioOverrides(scenario), context);
    results.push(result);

    if (result.skipped) {
      console.log(`SKIP | ${result.name} | ${result.reason}`);
      continue;
    }

    console.log(
      [
        result.passed ? 'PASS' : 'FAIL',
        result.name,
        `p50=${result.p50?.toFixed(1) ?? 'n/a'}ms`,
        `p95=${result.p95?.toFixed(1) ?? 'n/a'}ms`,
        `avg=${result.avg?.toFixed(1) ?? 'n/a'}ms`,
        `sizeP95=${result.sizeP95 ?? 'n/a'}`,
        `errorRate=${(result.errorRate * 100).toFixed(2)}%`,
      ].join(' | '),
    );

    const cooldownMs = scenario.cooldownMsAfter ?? profile.cooldownMsBetweenScenarios ?? 0;
    if (cooldownMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, cooldownMs));
    }
  }

  const rankedFailures = results
    .filter((result) => !result.skipped && !result.passed)
    .sort((left, right) => (right.p95 ?? 0) - (left.p95 ?? 0));

  const report = {
    generatedAt: new Date().toISOString(),
    supabaseUrl,
    profile: profileName,
    context: {
      userId: context.userId,
      resolvedGroupId: context.resolvedGroupId,
      alternateGroupId: context.alternateGroupId,
      isWorkspaceGroup: context.isWorkspaceGroup,
      groupCount: context.groups.length,
      authDurationMs: context.authDurationMs,
    },
    overrides: {
      only: process.env.COMMUNE_LOAD_ONLY ?? null,
      concurrency:
        Number.isFinite(Number(process.env.COMMUNE_LOAD_CONCURRENCY))
          ? Number(process.env.COMMUNE_LOAD_CONCURRENCY)
          : null,
      requests:
        Number.isFinite(Number(process.env.COMMUNE_LOAD_REQUESTS))
          ? Number(process.env.COMMUNE_LOAD_REQUESTS)
          : null,
      warmupConcurrency:
        Number.isFinite(Number(process.env.COMMUNE_LOAD_WARMUP_CONCURRENCY))
          ? Number(process.env.COMMUNE_LOAD_WARMUP_CONCURRENCY)
          : null,
      warmupRequests:
        Number.isFinite(Number(process.env.COMMUNE_LOAD_WARMUP_REQUESTS))
          ? Number(process.env.COMMUNE_LOAD_WARMUP_REQUESTS)
          : null,
    },
    overallPassed: rankedFailures.length === 0,
    results,
    rankedFailures,
  };

  if (process.env.COMMUNE_LOAD_OUTPUT) {
    await writeReport(process.env.COMMUNE_LOAD_OUTPUT, report);
  }

  if (profile.gating && rankedFailures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
