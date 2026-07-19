import { defineConfig, devices } from "@playwright/test";

const fixtureEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);
fixtureEnvironment.ORBIT_WEATHER_MODE = "fixture";

const testServerUrl = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: testServerUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run dev -- -H 127.0.0.1 -p 3100",
    url: testServerUrl,
    env: fixtureEnvironment,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
