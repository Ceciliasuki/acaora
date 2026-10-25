import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const windowsChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const testPort = Number(process.env.ACAORA_E2E_PORT ?? 3210);

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "browser-auth-compatibility.spec.ts",
  outputDir: "test-results/playwright",
  snapshotPathTemplate: "{testDir}/__screenshots__/{platform}/{arg}{ext}",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { outputFolder: "test-results/report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    colorScheme: "light",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: existsSync(windowsChrome) ? { executablePath: windowsChrome } : undefined,
  },
  webServer: {
    command: process.env.CI
      ? `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port ${testPort}`
      : `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${testPort}`,
    url: `http://127.0.0.1:${testPort}/api/version`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SITE_URL: `http://127.0.0.1:${testPort}`,
      ACAORA_ENVIRONMENT: "test",
      ACAORA_COMMIT_SHA: "e2e-fixed-commit",
      ACAORA_BUILD_TIME: "2026-08-16T08:00:00.000Z",
      ...(process.env.ACAORA_NEXT_DIST_DIR ? {ACAORA_NEXT_DIST_DIR:process.env.ACAORA_NEXT_DIST_DIR} : {}),
    },
  },
});
