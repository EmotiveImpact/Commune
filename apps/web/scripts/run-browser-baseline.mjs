import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

function getCliBaseUrl() {
  return process.argv.slice(2).find((arg) => arg !== '--');
}

function normalizeBaseUrl(input) {
  const value = input ?? getCliBaseUrl() ?? process.env.COMMUNE_LOAD_BASE_URL;
  if (!value) {
    throw new Error(
      'Missing base URL. Pass it as the first argument or set COMMUNE_LOAD_BASE_URL.',
    );
  }

  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getHeadlessMode() {
  return process.env.COMMUNE_LOAD_HEADLESS !== 'false';
}

function budgetPass(value, budget, strict) {
  if (budget == null) return true;
  if (value == null) return !strict;
  return value <= budget;
}

async function loadBudgetProfile() {
  const filePath = resolve(process.cwd(), 'load', 'browser-budgets.json');
  const raw = await readFile(filePath, 'utf8');
  const config = JSON.parse(raw);
  const profileName = process.env.COMMUNE_LOAD_PROFILE ?? config.defaultProfile ?? 'deployed';
  const profile = config.profiles?.[profileName];

  if (!profile) {
    const availableProfiles = Object.keys(config.profiles ?? {}).join(', ') || 'none';
    throw new Error(
      `Unknown browser baseline profile "${profileName}". Available profiles: ${availableProfiles}.`,
    );
  }

  return {
    profileName,
    profile,
  };
}

async function resolvePlaywright() {
  try {
    return await import('playwright');
  } catch {
    throw new Error(
      'Missing Playwright runtime. Run `pnpm --filter @commune/web add -D playwright` and `pnpm --filter @commune/web exec playwright install chromium`.',
    );
  }
}

async function persistStorageState(sourcePath) {
  const targetPath = process.env.COMMUNE_LOAD_SAVE_STORAGE_STATE;
  if (!targetPath) return;

  const resolvedTarget = resolve(process.cwd(), targetPath);
  await mkdir(dirname(resolvedTarget), { recursive: true });
  await copyFile(sourcePath, resolvedTarget);
}

function getCredentials() {
  const email = process.env.COMMUNE_LOAD_EMAIL;
  const password = process.env.COMMUNE_LOAD_PASSWORD;
  if (!email || !password) {
    return null;
  }

  return { email, password };
}

async function completeLogin(page, baseUrl, credentials, timeoutMs = 30_000) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: /log in/i }).click();

  await page.waitForFunction(
    () => window.location.pathname !== '/login',
    undefined,
    { timeout: timeoutMs },
  );
}

async function authenticateViaLogin(browser, baseUrl) {
  const credentials = getCredentials();
  if (!credentials) {
    return null;
  }

  const tempDir = await mkdtemp(resolve(tmpdir(), 'commune-browser-load-'));
  const statePath = resolve(tempDir, 'storage-state.json');
  const context = await browser.newContext();
  const page = await context.newPage();

  await completeLogin(page, baseUrl, credentials);
  await context.storageState({ path: statePath });
  await context.close();
  await persistStorageState(statePath);

  return {
    path: statePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function resolveAuthState(browser, baseUrl) {
  const providedStorageState = process.env.COMMUNE_LOAD_STORAGE_STATE;
  if (providedStorageState) {
    return {
      path: resolve(process.cwd(), providedStorageState),
      cleanup: null,
    };
  }

  return authenticateViaLogin(browser, baseUrl);
}

function getScenarioTimeout(scenario) {
  return scenario.timeoutMs ?? 30_000;
}

function isRequestRelevant(request) {
  const resourceType = request.resourceType();
  return resourceType !== 'image' && resourceType !== 'font' && resourceType !== 'media';
}

function isIgnorableRequestFailure(request) {
  const errorText = request.failure()?.errorText?.toLowerCase() ?? '';
  return (
    errorText.includes('err_aborted') ||
    errorText.includes('aborted') ||
    errorText.includes('cancelled') ||
    errorText.includes('canceled')
  );
}

async function waitForRequestDrain(page, getActiveRequestCount, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (getActiveRequestCount() === 0) {
      await page.waitForTimeout(250);
      if (getActiveRequestCount() === 0) {
        return;
      }
    }

    await page.waitForTimeout(100);
  }
}

async function waitForScenarioSettled(page, expectedPath, timeoutMs, getActiveRequestCount) {
  try {
    await page.waitForFunction(
      (path) => window.location.pathname === path,
      expectedPath,
      { timeout: Math.min(timeoutMs, 10_000) },
    );
  } catch {
    // Final path is validated after the route settles.
  }

  try {
    await page.waitForFunction(
      () => {
        const buffer = window.__COMMUNE_OBSERVABILITY__;
        if (!buffer) return true;
        return buffer.summary.activeQueryFetches === 0;
      },
      undefined,
      { timeout: timeoutMs },
    );
  } catch {
    // Observability may be disabled or a route may stay busy in the background.
  }

  if (typeof getActiveRequestCount === 'function') {
    await waitForRequestDrain(page, getActiveRequestCount, timeoutMs);
  } else {
    try {
      await page.waitForLoadState('networkidle', { timeout: 5_000 });
    } catch {
      // Some environments keep background connections open.
    }
  }

  await page.waitForTimeout(500);
}

async function waitForScenarioExpectations(page, scenario, timeoutMs) {
  if (scenario.expectedTitleIncludes) {
    await page.waitForFunction(
      (expectedTitle) => document.title.includes(expectedTitle),
      scenario.expectedTitleIncludes,
      { timeout: Math.min(timeoutMs, 10_000) },
    );
  }

  if (scenario.expectedTextIncludes) {
    await page.waitForFunction(
      (expectedText) => document.body.innerText.includes(expectedText),
      scenario.expectedTextIncludes,
      { timeout: Math.min(timeoutMs, 10_000) },
    );
  }
}

async function performScenarioAction(page, baseUrl, scenario) {
  if (!scenario.action) {
    return { skipped: false };
  }

  if (scenario.action === 'login') {
    const credentials = getCredentials();
    if (!credentials) {
      return {
        skipped: true,
        reason: 'requires login credentials (set COMMUNE_LOAD_EMAIL and COMMUNE_LOAD_PASSWORD)',
      };
    }

    await completeLogin(page, baseUrl, credentials, getScenarioTimeout(scenario));
    return { skipped: false };
  }

  if (scenario.action === 'openNotifications') {
    await page.getByRole('button', { name: /open notifications/i }).click();
    return { skipped: false };
  }

  if (scenario.action === 'switchWorkspace') {
    const selector = page.locator('[aria-label="Switch workspace"]').first();
    const selectorCount = await selector.count();
    if (selectorCount === 0) {
      return {
        skipped: true,
        reason: 'could not find the workspace switch control in the current shell',
      };
    }

    try {
      await selector.waitFor({ state: 'visible', timeout: 5_000 });
    } catch {
      return {
        skipped: true,
        reason: 'workspace switch control is not visible in the current shell',
      };
    }

    const currentValue = await selector.inputValue();
    await selector.click();

    const options = page.getByRole('option');
    const optionCount = await options.count();
    if (optionCount < 2) {
      return {
        skipped: true,
        reason: 'requires at least two available groups to switch workspaces',
      };
    }

    let nextWorkspaceLabel = null;
    for (let index = 0; index < optionCount; index += 1) {
      const optionText = (await options.nth(index).innerText()).trim();
      if (optionText && optionText !== currentValue) {
        nextWorkspaceLabel = optionText;
        break;
      }
    }

    if (!nextWorkspaceLabel) {
      return {
        skipped: true,
        reason: 'could not find a second distinct workspace option to switch to',
      };
    }

    await page.getByRole('option', { name: nextWorkspaceLabel, exact: true }).click();
    await page.waitForFunction(
      ([label, previousValue]) => {
        const input = document.querySelector('[aria-label="Switch workspace"]');
        if (!(input instanceof HTMLInputElement)) return false;
        return input.value === label && input.value !== previousValue;
      },
      [nextWorkspaceLabel, currentValue],
      { timeout: 10_000 },
    );

    return { skipped: false };
  }

  throw new Error(`Unsupported browser baseline action "${scenario.action}".`);
}

function summariseRun(snapshot, scenario, requestFailures) {
  const observability = snapshot.observability;
  const finalPath = snapshot.finalPath;
  const expectedPath = scenario.expectedPath ?? scenario.path;
  const routeSamples = observability?.route?.filter((sample) => sample.label === finalPath) ?? [];
  const apiSamples = observability?.api ?? [];
  const querySamples = observability?.query ?? [];
  const transferBytes = (snapshot.resources ?? []).reduce((sum, entry) => {
    const transferSize = Number(entry.transferSize ?? 0);
    const decodedBodySize = Number(entry.decodedBodySize ?? 0);
    return sum + (transferSize > 0 ? transferSize : decodedBodySize);
  }, 0);

  return {
    finalPath,
    pathMatched: finalPath === expectedPath,
    titleMatched: scenario.expectedTitleIncludes
      ? snapshot.title.includes(scenario.expectedTitleIncludes)
      : true,
    textMatched: scenario.expectedTextIncludes
      ? snapshot.text.includes(scenario.expectedTextIncludes)
      : true,
    title: snapshot.title,
    observabilityAvailable: Boolean(observability),
    routePaintMs:
      routeSamples.length > 0
        ? routeSamples[routeSamples.length - 1].durationMs
        : null,
    apiP95Ms: percentile(
      apiSamples.map((sample) => sample.durationMs).sort((a, b) => a - b),
      95,
    ),
    queryP95Ms: percentile(
      querySamples.map((sample) => sample.durationMs).sort((a, b) => a - b),
      95,
    ),
    apiCount: apiSamples.length,
    queryCount: querySamples.length,
    apiErrorCount: apiSamples.filter(
      (sample) => sample.ok === false || (typeof sample.status === 'number' && sample.status >= 400),
    ).length,
    queryErrorCount: querySamples.filter((sample) => sample.ok === false).length,
    requestFailureCount: requestFailures.length,
    transferBytes,
  };
}

async function executeScenario(browser, baseUrl, authStatePath, scenario) {
  const credentials = getCredentials();
  if (scenario.requiresAuth && !authStatePath) {
    return {
      name: scenario.name,
      skipped: true,
      reason: 'requires browser auth (set COMMUNE_LOAD_STORAGE_STATE or COMMUNE_LOAD_EMAIL and COMMUNE_LOAD_PASSWORD)',
    };
  }

  if (scenario.requiresCredentials && !credentials) {
    return {
      name: scenario.name,
      skipped: true,
      reason: 'requires login credentials (set COMMUNE_LOAD_EMAIL and COMMUNE_LOAD_PASSWORD)',
    };
  }

  const runs = [];
  let failures = 0;
  let cursor = 0;

  async function runOne() {
    const context = await browser.newContext(
      scenario.requiresAuth && authStatePath ? { storageState: authStatePath } : undefined,
    );
    const page = await context.newPage();
    let activeRelevantRequests = 0;
    const requestFailures = [];
    const timeoutMs = getScenarioTimeout(scenario);
    const expectedPath = scenario.expectedPath ?? scenario.path;

    page.on('request', (request) => {
      if (isRequestRelevant(request)) {
        activeRelevantRequests += 1;
      }
    });

    page.on('requestfinished', (request) => {
      if (isRequestRelevant(request)) {
        activeRelevantRequests = Math.max(0, activeRelevantRequests - 1);
      }
    });

    page.on('requestfailed', (request) => {
      if (isRequestRelevant(request)) {
        activeRelevantRequests = Math.max(0, activeRelevantRequests - 1);
      }

      if (!isIgnorableRequestFailure(request)) {
        requestFailures.push({
          url: request.url(),
          method: request.method(),
          error: request.failure()?.errorText ?? 'request failed',
        });
      }
    });

    const startedAt = performance.now();

    try {
      await page.goto(`${baseUrl}${scenario.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs,
      });
      await waitForScenarioSettled(page, scenario.path, timeoutMs, () => activeRelevantRequests);

      const actionOutcome = await performScenarioAction(page, baseUrl, scenario);
      if (actionOutcome.skipped) {
        runs.push({
          skipped: true,
          reason: actionOutcome.reason,
        });
        return;
      }

      await waitForScenarioSettled(page, expectedPath, timeoutMs, () => activeRelevantRequests);
      await waitForScenarioExpectations(page, scenario, timeoutMs);
      await waitForScenarioSettled(page, expectedPath, timeoutMs, () => activeRelevantRequests);

      const snapshot = await page.evaluate(() => ({
        finalPath: window.location.pathname,
        title: document.title,
        text: document.body.innerText,
        observability: window.__COMMUNE_OBSERVABILITY__ ?? null,
        resources: performance.getEntriesByType('resource').map((entry) => ({
          name: entry.name,
          transferSize: 'transferSize' in entry ? entry.transferSize : 0,
          decodedBodySize: 'decodedBodySize' in entry ? entry.decodedBodySize : 0,
          initiatorType: entry.initiatorType ?? 'other',
          duration: entry.duration ?? 0,
        })),
      }));

      const run = {
        skipped: false,
        navDurationMs: performance.now() - startedAt,
        ...summariseRun(snapshot, scenario, requestFailures),
      };

      const redirectedToLogin = scenario.requiresAuth && run.finalPath === '/login';
      const hasRunError =
        !run.pathMatched ||
        !run.titleMatched ||
        !run.textMatched ||
        redirectedToLogin ||
        run.apiErrorCount > 0 ||
        run.queryErrorCount > 0 ||
        (scenario.requiresObservability && !run.observabilityAvailable);

      if (hasRunError) {
        failures += 1;
      }

      runs.push(run);
    } catch (error) {
      failures += 1;
      runs.push({
        skipped: false,
        navDurationMs: performance.now() - startedAt,
        finalPath: null,
        pathMatched: false,
        titleMatched: false,
        textMatched: false,
        title: '',
        observabilityAvailable: false,
        routePaintMs: null,
        apiP95Ms: null,
        queryP95Ms: null,
        apiCount: 0,
        queryCount: 0,
        apiErrorCount: 1,
        queryErrorCount: 0,
        requestFailureCount: requestFailures.length + 1,
        transferBytes: 0,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await context.close();
    }
  }

  async function worker() {
    while (cursor < scenario.requests) {
      cursor += 1;
      await runOne();
    }
  }

  await Promise.all(Array.from({ length: scenario.concurrency }, () => worker()));

  const runnableRuns = runs.filter((run) => !run.skipped);
  if (runnableRuns.length === 0) {
    const skipReasons = Array.from(
      new Set(runs.map((run) => run.reason).filter(Boolean)),
    );

    return {
      name: scenario.name,
      skipped: true,
      reason: skipReasons[0] ?? 'scenario conditions not met',
    };
  }

  const navDurations = runnableRuns.map((run) => run.navDurationMs).sort((a, b) => a - b);
  const routePaints = runnableRuns
    .map((run) => run.routePaintMs)
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  const apiP95s = runnableRuns
    .map((run) => run.apiP95Ms)
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  const queryP95s = runnableRuns
    .map((run) => run.queryP95Ms)
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  const apiCounts = runnableRuns.map((run) => run.apiCount).sort((a, b) => a - b);
  const queryCounts = runnableRuns.map((run) => run.queryCount).sort((a, b) => a - b);
  const requestFailureCounts = runnableRuns
    .map((run) => run.requestFailureCount)
    .sort((a, b) => a - b);
  const transferBytes = runnableRuns.map((run) => run.transferBytes).sort((a, b) => a - b);
  const errorRate = runnableRuns.length === 0 ? 0 : failures / runnableRuns.length;
  const observabilityMisses = runnableRuns.filter((run) => !run.observabilityAvailable).length;
  const redirectsToLogin = scenario.requiresAuth
    ? runnableRuns.filter((run) => run.finalPath === '/login').length
    : 0;

  const navP95 = percentile(navDurations, 95);
  const routePaintP95 = percentile(routePaints, 95);
  const apiP95 = percentile(apiP95s, 95);
  const queryP95 = percentile(queryP95s, 95);
  const apiCountP95 = percentile(apiCounts, 95);
  const queryCountP95 = percentile(queryCounts, 95);
  const requestFailureCountP95 = percentile(requestFailureCounts, 95);
  const transferBytesP95 = percentile(transferBytes, 95);

  const passed =
    budgetPass(navP95, scenario.budgetNavMsP95, true) &&
    budgetPass(routePaintP95, scenario.budgetRoutePaintMsP95, Boolean(scenario.requiresObservability)) &&
    budgetPass(apiP95, scenario.budgetApiMsP95, Boolean(scenario.requiresObservability)) &&
    budgetPass(queryP95, scenario.budgetQueryMsP95, Boolean(scenario.requiresObservability)) &&
    budgetPass(transferBytesP95, scenario.budgetTransferBytesP95, false) &&
    budgetPass(apiCountP95, scenario.maxApiCountP95, Boolean(scenario.requiresObservability)) &&
    budgetPass(queryCountP95, scenario.maxQueryCountP95, Boolean(scenario.requiresObservability)) &&
    budgetPass(requestFailureCountP95, scenario.maxRequestFailureCountP95, false) &&
    errorRate <= scenario.maxErrorRate &&
    (!scenario.requiresObservability || observabilityMisses === 0) &&
    redirectsToLogin === 0;

  return {
    name: scenario.name,
    skipped: false,
    requestCount: runnableRuns.length,
    navAvg: average(navDurations),
    navP95,
    routePaintP95,
    apiP95,
    queryP95,
    apiCountP95,
    queryCountP95,
    requestFailureCountP95,
    transferBytesP95,
    errorRate,
    observabilityMisses,
    redirectsToLogin,
    passed,
  };
}

function getResultBreaches(result, scenario) {
  const breaches = [];
  const budgetChecks = [
    ['navP95', result.navP95, scenario.budgetNavMsP95, true],
    ['routePaintP95', result.routePaintP95, scenario.budgetRoutePaintMsP95, Boolean(scenario.requiresObservability)],
    ['apiP95', result.apiP95, scenario.budgetApiMsP95, Boolean(scenario.requiresObservability)],
    ['queryP95', result.queryP95, scenario.budgetQueryMsP95, Boolean(scenario.requiresObservability)],
    ['apiCountP95', result.apiCountP95, scenario.maxApiCountP95, Boolean(scenario.requiresObservability)],
    ['queryCountP95', result.queryCountP95, scenario.maxQueryCountP95, Boolean(scenario.requiresObservability)],
    ['requestFailureCountP95', result.requestFailureCountP95, scenario.maxRequestFailureCountP95, false],
    ['transferBytesP95', result.transferBytesP95, scenario.budgetTransferBytesP95, false],
  ];

  for (const [metric, actual, budget, strict] of budgetChecks) {
    if (!budgetPass(actual, budget, strict)) {
      breaches.push({ metric, actual, budget });
    }
  }

  if (result.errorRate > scenario.maxErrorRate) {
    breaches.push({
      metric: 'errorRate',
      actual: result.errorRate,
      budget: scenario.maxErrorRate,
    });
  }

  if (scenario.requiresObservability && result.observabilityMisses > 0) {
    breaches.push({
      metric: 'observabilityMisses',
      actual: result.observabilityMisses,
      budget: 0,
    });
  }

  if (result.redirectsToLogin > 0) {
    breaches.push({
      metric: 'redirectsToLogin',
      actual: result.redirectsToLogin,
      budget: 0,
    });
  }

  return breaches;
}

async function writeReport(outputPath, report) {
  const resolvedOutput = resolve(process.cwd(), outputPath);
  await mkdir(dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, JSON.stringify(report, null, 2));
  console.log(`REPORT | ${resolvedOutput}`);
}

async function main() {
  const baseUrl = normalizeBaseUrl();
  const { profileName, profile } = await loadBudgetProfile();
  const { chromium } = await resolvePlaywright();
  const browser = await chromium.launch({ headless: getHeadlessMode() });

  let authState = null;

  try {
    authState = await resolveAuthState(browser, baseUrl);

    const results = [];
    for (const scenario of profile.scenarios) {
      const result = await executeScenario(browser, baseUrl, authState?.path ?? null, scenario);
      results.push(result);

      if (result.skipped) {
        console.log(`SKIP | ${result.name} | ${result.reason}`);
        continue;
      }

      const statusLabel = result.passed ? 'PASS' : profile.gating ? 'FAIL' : 'WARN';
      console.log(
        [
          statusLabel,
          result.name,
          `navP95=${result.navP95?.toFixed(1) ?? 'n/a'}ms`,
          `routeP95=${result.routePaintP95?.toFixed(1) ?? 'n/a'}ms`,
          `apiP95=${result.apiP95?.toFixed(1) ?? 'n/a'}ms`,
          `queryP95=${result.queryP95?.toFixed(1) ?? 'n/a'}ms`,
          `apiCountP95=${result.apiCountP95 ?? 'n/a'}`,
          `queryCountP95=${result.queryCountP95 ?? 'n/a'}`,
          `requestFailuresP95=${result.requestFailureCountP95 ?? 'n/a'}`,
          `bytesP95=${result.transferBytesP95 ?? 'n/a'}`,
          `errorRate=${(result.errorRate * 100).toFixed(2)}%`,
          `obsMisses=${result.observabilityMisses}`,
          `loginRedirects=${result.redirectsToLogin}`,
        ].join(' | '),
      );
    }

    const rankedFailures = results
      .filter((result) => !result.skipped && !result.passed)
      .map((result) => {
        const scenario = profile.scenarios.find((entry) => entry.name === result.name);
        const breaches = scenario ? getResultBreaches(result, scenario) : [];
        return { ...result, breaches };
      })
      .sort((left, right) => right.breaches.length - left.breaches.length || right.errorRate - left.errorRate);

    const report = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      profile: profileName,
      gating: Boolean(profile.gating),
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
  } finally {
    if (authState?.cleanup) {
      await authState.cleanup();
    }
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
