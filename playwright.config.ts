import { defineConfig, devices } from "@playwright/test";

const APP = "http://localhost:5174";

export default defineConfig({
  testDir: "e2e",
  // One emulator suite, reset per test: specs can't run side by side.
  workers: 1,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/globalSetup.ts",
  use: { baseURL: APP, trace: "retain-on-failure" },
  projects: [{ name: "phone", use: devices["Pixel 7"] }],
  // Emulators come from `npm run test:e2e` (emulators:exec), which also stops them cleanly.
  webServer: {
    command: "npx vite --mode e2e --port 5174 --strictPort",
    url: APP,
    reuseExistingServer: !process.env["CI"],
  },
});
