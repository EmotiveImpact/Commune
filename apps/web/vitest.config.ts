import { defineConfig } from "vitest/config";
import { sharedCode } from "./vite.config";

export default defineConfig({
  resolve: { alias: sharedCode },
  test: {
    environment: "jsdom",
    // packages/core's own tests run here too, in Node (each file says so).
    include: ["tests/**/*.test.{ts,tsx}", "../../packages/core/tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
});
