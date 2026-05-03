import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

function toKiB(bytes) {
  return bytes / 1024;
}

function pickLargestMatch(files, budget) {
  const candidates = files.filter((file) => {
    if (!file.name.startsWith(budget.prefix)) {
      return false;
    }

    if (budget.excludeContains && file.name.includes(budget.excludeContains)) {
      return false;
    }

    return true;
  });

  if (candidates.length === 0) {
    throw new Error(`No built asset matched budget "${budget.name}" (${budget.prefix})`);
  }

  candidates.sort((a, b) => b.size - a.size);
  return candidates[0];
}

async function readBudgets() {
  const filePath = resolve(process.cwd(), 'load', 'bundle-budgets.json');
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readAssets() {
  const assetsDir = resolve(process.cwd(), 'dist', 'assets');
  const entries = await readdir(assetsDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const path = resolve(assetsDir, entry.name);
    const stats = await stat(path);
    files.push({
      name: entry.name,
      size: stats.size,
      path,
    });
  }

  return files;
}

async function main() {
  const budgets = await readBudgets();
  const assets = await readAssets();

  if (assets.length === 0) {
    throw new Error('No build assets found in dist/assets. Run the web build first.');
  }

  const failures = [];
  const rows = [];

  for (const budget of budgets.assets) {
    const asset = pickLargestMatch(assets, budget);
    const sizeKiB = toKiB(asset.size);
    const passed = sizeKiB <= budget.maxKiB;

    rows.push({
      name: budget.name,
      file: asset.name,
      sizeKiB,
      maxKiB: budget.maxKiB,
      passed,
    });

    if (!passed) {
      failures.push(
        `${budget.name} is ${sizeKiB.toFixed(2)} KiB, over the ${budget.maxKiB} KiB budget (${asset.name})`,
      );
    }
  }

  for (const row of rows) {
    console.log(
      [
        row.passed ? 'PASS' : 'FAIL',
        row.name,
        row.file,
        `${row.sizeKiB.toFixed(2)} KiB <= ${row.maxKiB} KiB`,
      ].join(' | '),
    );
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
