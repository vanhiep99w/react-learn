import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 120_000,
  use: { baseURL: 'http://127.0.0.1:4174', browserName: 'chromium' },
  webServer: {
    command: 'python3 -m http.server 4174 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:4174/hello/',
    reuseExistingServer: false,
  },
});
