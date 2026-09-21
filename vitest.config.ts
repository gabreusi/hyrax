import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "core",
          environment: "node",
          include: ["src/core/**/*.test.ts", "src/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "happy-dom",
          include: ["src/dom/**/*.test.ts"],
          exclude: ["src/dom/**/*.browser.test.ts"],
        },
      },
      {
        // Layout and Shadow DOM need a real browser: happy-dom does not resolve `%`, `dvh` or
        // `calc()`, and it does not retarget events that come out of a shadow tree.
        extends: true,
        test: {
          name: "dom-browser",
          include: ["src/dom/**/*.browser.test.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            screenshotFailures: false,
          },
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          environment: "happy-dom",
          include: ["src/react/**/*.test.{ts,tsx}"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
      thresholds: {
        "src/core/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
        "src/dom/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
