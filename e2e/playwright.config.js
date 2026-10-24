// @ts-check
const { defineConfig } = require('@playwright/test');
const fs = require('fs');

// ถ้ายังไม่ได้ `npx playwright install` ให้ใช้ Chromium ที่แคชไว้ในเครื่อง
const CACHED_CHROMIUM =
  process.env.SNT_CHROMIUM ||
  '/Users/artit/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const launchOptions = fs.existsSync(CACHED_CHROMIUM) ? { executablePath: CACHED_CHROMIUM } : {};

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.SNT_URL || 'http://localhost:4173',
    locale: 'th-TH',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions,
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
