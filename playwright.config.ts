import {defineConfig, devices} from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const port = new URL(baseURL).port || '3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: {baseURL, trace: 'retain-on-failure'},
  webServer: {command: `npm run dev -- --port ${port}`, url: `${baseURL}/en`, reuseExistingServer: !process.env.CI, timeout: 120000},
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome']}},
    {name: 'mobile', use: {...devices['iPhone 13'], defaultBrowserType: 'chromium'}}
  ]
});
