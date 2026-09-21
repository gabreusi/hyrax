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
        // The tooling in scripts/ (the examples checker).
        extends: true,
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.mjs"],
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
        // Layout, Shadow DOM and real pointer events need a real browser: happy-dom does not resolve
        // `%`, `dvh` or `calc()`, does not retarget events that come out of a shadow tree, and
        // removes a capture listener even when the removal forgets the capture flag.
        extends: true,
        test: {
          name: "browser",
          include: ["src/dom/**/*.browser.test.ts", "src/react/**/*.browser.test.tsx"],
          setupFiles: ["./src/react/test-setup.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            screenshotFailures: false,
          },
        },
        // Listed up front: when Vite finds a dependency in the middle of a run it reloads the page,
        // and a test can then end up with two copies of React ("reading 'useState'").
        optimizeDeps: {
          include: [
            "react",
            "react/jsx-dev-runtime",
            "react-dom",
            "react-dom/client",
            "@testing-library/react",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          environment: "happy-dom",
          include: ["src/react/**/*.test.{ts,tsx}"],
          exclude: ["src/react/**/*.browser.test.tsx"],
          setupFiles: ["./src/react/test-setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts", "**/test-setup.ts"],
      thresholds: {
        "src/core/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
        "src/dom/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
        "src/react/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
