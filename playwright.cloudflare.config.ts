import {defineConfig} from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './tests',
  testMatch: ['e2e/*.spec.ts', 'cloudflare-e2e/*.spec.ts'],
  use: {...base.use, baseURL: 'http://127.0.0.1:8787'},
  webServer: {
    command: 'npm run preview:cloudflare',
    url: 'http://127.0.0.1:8787/en',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
