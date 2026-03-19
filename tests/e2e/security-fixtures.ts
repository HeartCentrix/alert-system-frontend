/**
 * Security Test Fixtures and Helper Functions
 * 
 * Provides common utilities for security testing:
 * - Authentication helpers
 * - Token manipulation
 * - Security assertions
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test'

// Test credentials (update to match your test database)
export const TEST_CREDENTIALS = {
  email: 'admin@tmalert.com',
  password: 'Password123!',
}

export const TEST_MFA_CREDENTIALS = {
  email: 'mfauser@tmalert.com',
  password: 'Password123!',
}

// Extend Playwright test with security-specific fixtures
export const test = base.extend<{
  authenticatedPage: Page
  unauthenticatedPage: Page
  loginPage: Page
}>({
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Login before providing the page
    await page.goto('/#/login')
    await page.waitForLoadState('networkidle')
    
    // Perform login
    await page.fill('input[type="email"], input[name="email"]', TEST_CREDENTIALS.email)
    await page.fill('input[type="password"], input[name="password"]', TEST_CREDENTIALS.password)
    await page.click('button[type="submit"]')
    
    // Wait for successful login and redirect
    await page.waitForURL(/\/#\/dashboard|\/#\/login/, { timeout: 10000 })
    
    await use(page)
    
    // Cleanup: logout
    try {
      await page.evaluate(() => {
        sessionStorage.clear()
        localStorage.clear()
      })
    } catch (e) {
      // Ignore cleanup errors
    }
  },
  
  unauthenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Ensure no auth data
    await page.addInitScript(() => {
      sessionStorage.clear()
      localStorage.clear()
    })
    
    await use(page)
  },
  
  loginPage: async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/#/login')
    await page.waitForLoadState('networkidle')
    await use(page)
  },
})

export { expect }

/**
 * Helper: Get current session tokens
 */
export async function getSessionTokens(page: Page): Promise<{
  accessToken: string | null
  refreshToken: string | null
}> {
  return await page.evaluate(() => ({
    accessToken: sessionStorage.getItem('access_token'),
    refreshToken: sessionStorage.getItem('refresh_token'),
  }))
}

/**
 * Helper: Clear all session data
 */
export async function clearSessionData(page: Page): Promise<void> {
  await page.evaluate(() => {
    sessionStorage.clear()
    localStorage.clear()
  })
}

/**
 * Helper: Inject malicious cookie (for XSS testing)
 */
export async function injectMaliciousCookie(page: Page, name: string, value: string): Promise<void> {
  await page.addInitScript((params) => {
    document.cookie = `${params.name}=${params.value}; path=/`
  }, { name, value })
}

/**
 * Helper: Wait for token refresh to complete
 */
export async function waitForTokenRefresh(page: Page, timeout = 10000): Promise<void> {
  await page.waitForResponse(
    response => response.url().includes('/auth/refresh') && response.status() === 200,
    { timeout }
  )
}

/**
 * Helper: Count refresh requests in a time window
 */
export async function countRefreshRequests(page: Page, action: () => Promise<void>): Promise<number> {
  const refreshRequests: any[] = []
  
  page.on('request', request => {
    if (request.url().includes('/auth/refresh')) {
      refreshRequests.push(request)
    }
  })
  
  await action()
  
  // Wait a bit for all requests to complete
  await page.waitForTimeout(2000)
  
  return refreshRequests.length
}

/**
 * Helper: Assert security headers are present
 */
export async function assertSecurityHeaders(page: Page, response: any): Promise<void> {
  const headers = response.headers()
  
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['referrer-policy']).toContain('strict-origin')
  expect(headers['cache-control']).toContain('no-store')
}

/**
 * Helper: Verify CSP header
 */
export async function assertCSPHeader(page: Page, response: any): Promise<void> {
  const headers = response.headers()
  const csp = headers['content-security-policy']
  
  expect(csp).toBeDefined()
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("frame-ancestors 'none'")
}

/**
 * Helper: Simulate multiple simultaneous requests
 */
export async function simulateSimultaneousRequests(
  page: Page,
  requestFn: () => Promise<void>,
  count: number = 5
): Promise<void> {
  const promises = []
  for (let i = 0; i < count; i++) {
    promises.push(requestFn())
  }
  await Promise.all(promises)
}

/**
 * Helper: Get referrer policy from meta tag or HTTP headers
 * Note: document.referrerPolicy is not standard, so we check the meta tag
 */
export async function getReferrerPolicy(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // Check meta tag
    const meta = document.querySelector('meta[name="referrer"]') as HTMLMetaElement
    if (meta && meta.content) {
      return meta.content
    }
    // Fallback: return empty string (policy is set via HTTP header)
    return ''
  })
}

/**
 * Helper: Check if lockout is persisted after refresh
 */
export async function isLockoutPersisted(page: Page): Promise<boolean> {
  const lockoutData = await page.evaluate(() => {
    const lockout = localStorage.getItem('login_lockout')
    if (!lockout) return false
    
    try {
      const { until } = JSON.parse(lockout)
      return Date.now() < until
    } catch {
      return false
    }
  })
  
  return lockoutData
}
