import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Security Test Configuration
 * 
 * Tests cover:
 * - Token Refresh Race Condition
 * - XSS Prevention in CSRF Token
 * - Prototype Pollution Prevention
 * - Security Headers
 * - Brute Force Protection
 * - MFA TOTP Countdown
 * - Token Leakage Prevention
 * - Authentication Flow Security
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Timeout per test
  timeout: 60 * 1000,
  
  // Timeout for expect assertions
  expect: {
    timeout: 10 * 1000,
  },
  
  // Run tests in parallel
  fullyParallel: false,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 1,
  
  // Opt out of parallel tests
  workers: 1,
  
  // Reporter
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-results.json' }],
    ['list'],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL for the frontend
    baseURL: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Collect video on failure
    video: 'retain-on-failure',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    
    // Security settings
    ignoreHTTPSErrors: false,
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  
  // Run local dev server before starting tests
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
})
