/**
 * Commune's shared rules, used by name as "@commune/core" (an alias in
 * apps/web's tsconfig.json, vite.config.ts and vitest.config.ts): splitting an
 * expense, balances between members, and reading the amounts people type.
 * Its tests live in packages/core/tests and run with the web app's tests.
 */
export * from "./balances";
export * from "./expenseSplit";
export * from "./money";
