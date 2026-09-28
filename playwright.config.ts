import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1, // the workflow shares one database, so run serially
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: {
    // Resets + seeds the DB, builds, then serves on :3100
    command: "npm run db:reset && npm run build && npx next start -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
